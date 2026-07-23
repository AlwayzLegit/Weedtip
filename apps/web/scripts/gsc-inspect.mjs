#!/usr/bin/env node
/**
 * Google Search Console coverage monitor.
 *
 * Calls the URL Inspection API for our pages and records how Google sees each
 * one — indexed vs not, and the reason (coverageState) — into
 * public.page_index_status. That turns "why isn't the site ranking" into a
 * concrete list: which URLs are "Crawled - currently not indexed" (thin
 * content), "Discovered - currently not indexed" (crawl budget), blocked, etc.
 *
 * The URL Inspection API is capped at 2,000 calls/day per property, so each run
 * inspects the STALEST slice (never-checked first, then oldest checked_at) and
 * cycles through the whole site over several days.
 *
 * Auth: a Google Cloud service account added as a user on the Search Console
 * property. We sign the OAuth JWT with node crypto — no googleapis dependency.
 *
 * Runs on CI (needs outbound network). Node 22+ (Supabase needs native WS).
 *
 * Env:
 *   GSC_SERVICE_ACCOUNT_JSON   the service-account key JSON (whole file contents)
 *   GSC_SITE_URL               property, default "sc-domain:weedtip.com"
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SITE_URL       default https://www.weedtip.com
 *
 * Usage:
 *   node scripts/gsc-inspect.mjs [--limit 2000] [--url <absolute>] [--dry-run]
 */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const {
  GSC_SERVICE_ACCOUNT_JSON,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.weedtip.com').replace(/\/$/, '');
const GSC_SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:weedtip.com';

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!GSC_SERVICE_ACCOUNT_JSON) {
  console.error('Set GSC_SERVICE_ACCOUNT_JSON (the service-account key file contents).');
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const dryRun = flag('--dry-run');
const onlyUrl = opt('--url', null);
const limit = Math.min(Number(opt('--limit', 2000)), 2000); // API hard cap is 2000/day

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Service-account OAuth (JWT bearer, signed locally) ─────────────────────
function serviceAccount() {
  const sa = JSON.parse(GSC_SERVICE_ACCOUNT_JSON);
  // Some secret stores escape newlines in the PEM — normalize defensively.
  sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
  return sa;
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key).toString('base64url');
  const assertion = `${signingInput}.${signature}`;

  const body =
    `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}` +
    `&assertion=${encodeURIComponent(assertion)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

// ─── URL Inspection ─────────────────────────────────────────────────────────
async function inspect(token, inspectionUrl) {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl, siteUrl: GSC_SITE_URL, languageCode: 'en-US' }),
  });
  if (res.status === 429) return { rateLimited: true };
  if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 160)}` };
  return { data: await res.json() };
}

function toRow(inspectionUrl, data) {
  const r = data?.inspectionResult?.indexStatusResult ?? {};
  return {
    url: inspectionUrl,
    verdict: r.verdict ?? null,
    coverage_state: r.coverageState ?? null,
    robots_txt_state: r.robotsTxtState ?? null,
    indexing_state: r.indexingState ?? null,
    page_fetch_state: r.pageFetchState ?? null,
    last_crawl_time: r.lastCrawlTime ?? null,
    google_canonical: r.googleCanonical ?? null,
    user_canonical: r.userCanonical ?? null,
    referring_urls: Array.isArray(r.referringUrls) ? r.referringUrls.length : null,
    in_sitemap: Array.isArray(r.sitemap) ? r.sitemap.length > 0 : null,
    checked_at: new Date().toISOString(),
  };
}

// ─── Which URLs to inspect (stalest first) ──────────────────────────────────
async function candidateUrls() {
  if (onlyUrl) return [onlyUrl];

  const core = ['', '/dispensaries', '/deliveries', '/products', '/brands', '/strains', '/deals', '/learn'].map(
    (p) => `${SITE_URL}${p}`,
  );

  // Active canonical listings, highest-signal first (review_count as a proxy).
  const PAGE = 1000;
  const slugs = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('dispensaries')
      .select('slug')
      .eq('status', 'active')
      .is('canonical_slug', null)
      .order('review_count', { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    slugs.push(...data.map((d) => `${SITE_URL}/dispensary/${d.slug}`));
    if (data.length < PAGE) break;
  }
  const candidates = [...new Set([...core, ...slugs])];

  // Prefer never-checked, then oldest checked_at — so runs cycle the whole site.
  const checkedAt = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from('page_index_status')
      .select('url, checked_at')
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    for (const r of data) checkedAt.set(r.url, r.checked_at);
    if (data.length < PAGE) break;
  }
  candidates.sort((a, b) => {
    const ca = checkedAt.get(a);
    const cb = checkedAt.get(b);
    if (!ca && cb) return -1;
    if (ca && !cb) return 1;
    if (!ca && !cb) return 0;
    return new Date(ca) - new Date(cb);
  });
  return candidates.slice(0, limit);
}

async function run() {
  const urls = await candidateUrls();
  console.log(`GSC inspect: ${urls.length} URLs against ${GSC_SITE_URL} (cap ${limit}/day)`);
  if (dryRun) {
    for (const u of urls.slice(0, 15)) console.log(`  · ${u}`);
    if (urls.length > 15) console.log(`  … and ${urls.length - 15} more`);
    console.log('(dry run — no API calls)');
    return;
  }

  const sa = serviceAccount();
  let token = await getAccessToken(sa);
  const tokenAt = Date.now();

  const buffer = [];
  const tally = {};
  let done = 0;
  for (const url of urls) {
    // Refresh the token every ~50 min.
    if (Date.now() - tokenAt > 50 * 60_000) token = await getAccessToken(sa);

    const { data, error, rateLimited } = await inspect(token, url);
    if (rateLimited) {
      console.log('Hit the daily quota (HTTP 429) — stopping early.');
      break;
    }
    if (error) {
      console.log(`· ${url}: ${error}`);
      continue;
    }
    const row = toRow(url, data);
    buffer.push(row);
    tally[row.coverage_state ?? 'unknown'] = (tally[row.coverage_state ?? 'unknown'] ?? 0) + 1;
    done++;

    if (buffer.length >= 100) {
      const { error: upErr } = await supabase.from('page_index_status').upsert(buffer, { onConflict: 'url' });
      if (upErr) console.log(`  upsert failed: ${upErr.message}`);
      buffer.length = 0;
    }
    await new Promise((r) => setTimeout(r, 120)); // ~500/min, under the per-minute cap
  }
  if (buffer.length) {
    const { error: upErr } = await supabase.from('page_index_status').upsert(buffer, { onConflict: 'url' });
    if (upErr) console.log(`  upsert failed: ${upErr.message}`);
  }

  console.log(`\nInspected ${done} URLs. Coverage breakdown:`);
  for (const [state, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${state}`);
  }
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
