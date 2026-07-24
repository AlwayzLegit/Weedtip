#!/usr/bin/env node
/**
 * Google ratings backfill — standalone runner.
 *
 * Mirrors backfillGoogleRatingsBatch() in
 * apps/web/app/admin/google-enrich-actions.ts, but talks to Supabase with the
 * service-role key instead of an admin browser session, so it needs no dev
 * server and no login. Same semantics as the in-app console:
 *
 *  - Queue = active listings with a google_place_id whose rating is missing or
 *    cached longer than the 30-day window Google permits.
 *  - Every fetch stamps google_rating_at, including places with no ratings and
 *    dead place_ids, so nothing is re-billed until the window lapses.
 *  - Stores googleMapsUri for attribution.
 *
 * Safe to stop (Ctrl-C) and re-run: progress is written per row, and re-running
 * just picks up whatever is still queued.
 *
 * Usage:
 *   cd apps/web
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   GOOGLE_PLACES_API_KEY=... \
 *   node scripts/backfill-google-ratings.mjs
 *
 * Optional env:
 *   DRY_RUN=1     fetch and report, write nothing
 *   LIMIT=200     stop after roughly this many listings (for a trial run)
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

const missing = [
  !SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
  !SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  !PLACES_KEY && 'GOOGLE_PLACES_API_KEY',
].filter(Boolean);
if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN === '1';
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;

// Must match GOOGLE_RATING_TTL_DAYS in apps/web/lib/google-rating.ts.
const TTL_DAYS = 30;
const BATCH = 60;
const CONCURRENCY = 8;
// Stay under Places' GetPlaceRequest per-minute quota (600/min on default
// projects — the 2026-07 full run hit it at unthrottled 8-way concurrency and
// needed manual re-run loops). Requests are paced to this budget, and a 429
// backs off one quota window and retries once before leaving the row queued.
const PACE_PER_MIN = process.env.PACE_PER_MIN ? Number(process.env.PACE_PER_MIN) : 550;
const QUOTA_BACKOFF_MS = 65_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let stopping = false;
process.on('SIGINT', () => {
  if (stopping) process.exit(130);
  stopping = true;
  console.log('\nFinishing the current batch, then stopping…  (Ctrl-C again to force)');
});

const staleBefore = () => new Date(Date.now() - TTL_DAYS * 864e5).toISOString();

function queueFilter(q) {
  return q
    .not('google_place_id', 'is', null)
    .or(`google_rating_at.is.null,google_rating_at.lt.${staleBefore()}`)
    .eq('status', 'active');
}

async function remaining() {
  const { count } = await queueFilter(
    supabase.from('dispensaries').select('id', { count: 'exact', head: true }),
  );
  return count ?? 0;
}

const tally = { processed: 0, rated: 0, unrated: 0, failed: 0 };

async function processOne(row) {
  try {
    let res = await fetch(`https://places.googleapis.com/v1/places/${row.google_place_id}`, {
      headers: {
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri',
      },
    });

    if (res.status === 429) {
      // Quota window exhausted — wait it out once; a second 429 stays queued.
      console.error(`  429 from Places — backing off ${QUOTA_BACKOFF_MS / 1000}s…`);
      await sleep(QUOTA_BACKOFF_MS);
      res = await fetch(`https://places.googleapis.com/v1/places/${row.google_place_id}`, {
        headers: {
          'X-Goog-Api-Key': PLACES_KEY,
          'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri',
        },
      });
    }

    if (!res.ok) {
      // A dead place_id would retry forever — stamp it so it waits out the TTL.
      if (res.status === 404) {
        tally.unrated += 1;
        if (!DRY_RUN) {
          await supabase
            .from('dispensaries')
            .update({
              google_rating: null,
              google_rating_count: null,
              google_rating_at: new Date().toISOString(),
            })
            .eq('id', row.id);
        }
        return;
      }
      tally.failed += 1;
      if (res.status === 403 || res.status === 429) {
        console.error(`  HTTP ${res.status} from Places — check the key's quota and restrictions.`);
      }
      return;
    }

    const json = await res.json();
    // Google omits `rating` entirely for places with no ratings yet.
    const hasRating = typeof json.rating === 'number' && (json.userRatingCount ?? 0) > 0;

    if (!DRY_RUN) {
      await supabase
        .from('dispensaries')
        .update({
          google_rating: hasRating ? Math.round(json.rating * 10) / 10 : null,
          google_rating_count: hasRating ? (json.userRatingCount ?? 0) : null,
          google_rating_at: new Date().toISOString(),
          ...(json.googleMapsUri ? { google_maps_uri: json.googleMapsUri } : {}),
        })
        .eq('id', row.id);
    }
    if (hasRating) tally.rated += 1;
    else tally.unrated += 1;
  } catch (err) {
    tally.failed += 1;
    console.error(`  ${row.id}: ${err?.message ?? err}`);
  }
}

const started = Date.now();
let left = await remaining();
console.log(
  `${left.toLocaleString()} listings queued${DRY_RUN ? '  (DRY RUN — nothing will be written)' : ''}`,
);
if (Number.isFinite(LIMIT)) console.log(`Stopping after ~${LIMIT} listings (LIMIT set).`);

while (!stopping && left > 0 && tally.processed < LIMIT) {
  const { data: rows, error } = await queueFilter(
    supabase.from('dispensaries').select('id,google_place_id'),
  )
    .order('google_rating_at', { nullsFirst: true })
    .limit(BATCH);

  if (error) {
    console.error(`Query failed: ${error.message}`);
    process.exit(1);
  }
  const batch = rows ?? [];
  if (batch.length === 0) break;

  const chunkBudgetMs = Math.ceil((CONCURRENCY / PACE_PER_MIN) * 60_000);
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunkStart = Date.now();
    await Promise.all(batch.slice(i, i + CONCURRENCY).map(processOne));
    const wait = chunkBudgetMs - (Date.now() - chunkStart);
    if (wait > 0) await sleep(wait);
  }
  tally.processed += batch.length;

  // In a dry run nothing is stamped, so the queue never drains — count down
  // locally instead of re-querying, or this would loop forever.
  left = DRY_RUN ? Math.max(0, left - batch.length) : await remaining();

  const mins = (Date.now() - started) / 60000;
  const rate = tally.processed / Math.max(mins, 0.01);
  console.log(
    `${tally.processed.toLocaleString()} done · ${tally.rated.toLocaleString()} rated · ` +
      `${tally.unrated.toLocaleString()} unrated · ${tally.failed} errors · ` +
      `${left.toLocaleString()} left · ~${Math.ceil(left / Math.max(rate, 1))} min remaining`,
  );
}

console.log(
  `\nDone. ${tally.rated.toLocaleString()} rated, ${tally.unrated.toLocaleString()} unrated on Google, ` +
    `${tally.failed} errors, ${left.toLocaleString()} still queued.`,
);
if (tally.failed > 0) {
  console.log('Errors are transient by default — just re-run to retry those rows.');
}
