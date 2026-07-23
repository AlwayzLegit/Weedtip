#!/usr/bin/env node
/**
 * Push our URLs to IndexNow so the engines that support it (Bing, Yandex,
 * Naver, Seznam — NOT Google) re-crawl changed pages quickly instead of waiting
 * for discovery. Submitting to the api.indexnow.org hub fans out to all of them.
 *
 * Runs on CI (needs outbound network); this sandbox's egress is blocked. Node 22+
 * (Supabase needs native WebSocket).
 *
 * Usage:
 *   cd apps/web
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *   node scripts/indexnow-submit.mjs [--since 2] [--all] [--dry-run] [--limit N]
 *
 *   --since <days>  only dispensaries updated in the last N days (default 2)
 *   --all           submit every active canonical listing + core pages
 *   --dry-run       print what would be submitted, send nothing
 *   --limit <N>     cap total URLs (safety)
 *
 * The key is public by design and is served at ${SITE_URL}/${INDEXNOW_KEY}.txt.
 * Keep INDEXNOW_KEY here in sync with apps/web/lib/indexnow.ts and that file.
 */
import { createClient } from '@supabase/supabase-js';

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '7c2f4e28ef2ccf7b90c82e2b5954ee45';
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.weedtip.com').replace(/\/$/, '');
const HOST = new URL(SITE_URL).host;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_BATCH = 10_000;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const all = flag('--all');
const dryRun = flag('--dry-run');
const sinceDays = Number(opt('--since', 2));
const hardLimit = Number(opt('--limit', Infinity));

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CORE_PATHS = ['', '/dispensaries', '/deliveries', '/products', '/brands', '/strains', '/deals', '/learn'];

/** Page past PostgREST's 1k row cap. */
async function fetchAll(build) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

async function collectUrls() {
  const urls = new Set(CORE_PATHS.map((p) => `${SITE_URL}${p}`));

  // Active, canonical listings — the bulk of the site.
  const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const rows = await fetchAll((f, t) => {
    let q = supabase
      .from('dispensaries')
      .select('slug, updated_at')
      .eq('status', 'active')
      .is('canonical_slug', null)
      .order('updated_at', { ascending: false })
      .range(f, t);
    if (!all) q = q.gte('updated_at', sinceIso);
    return q;
  });
  for (const d of rows) urls.add(`${SITE_URL}/dispensary/${d.slug}`);

  return [...urls].slice(0, hardLimit === Infinity ? undefined : hardLimit);
}

async function submit(batch) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: batch,
    }),
  });
  return res.status;
}

async function run() {
  const urls = await collectUrls();
  console.log(
    `IndexNow: ${urls.length} URLs (${all ? 'full' : `updated ≤ ${sinceDays}d`}) → host ${HOST}`,
  );
  if (urls.length === 0) {
    console.log('Nothing to submit.');
    return;
  }
  if (dryRun) {
    for (const u of urls.slice(0, 10)) console.log(`  · ${u}`);
    if (urls.length > 10) console.log(`  … and ${urls.length - 10} more`);
    console.log('(dry run — nothing sent)');
    return;
  }
  for (let i = 0; i < urls.length; i += MAX_BATCH) {
    const batch = urls.slice(i, i + MAX_BATCH);
    const status = await submit(batch);
    const ok = status === 200 || status === 202;
    console.log(`  batch ${i / MAX_BATCH + 1}: ${batch.length} URLs → HTTP ${status} ${ok ? '✓' : '✗'}`);
    if (!ok) process.exitCode = 1;
  }
  console.log('Done.');
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
