#!/usr/bin/env node
/**
 * Best-effort menu seeding: visit each dispensary's own website, harvest the
 * products it shows, and upsert them into the empty `products` table so the
 * 9k listings stop reading as thin (near-zero menu content today).
 *
 * This is intentionally a *best-effort* content seed, not a POS integration.
 * Every POS (Dutchie, Jane, Meadow, Tymber, custom) renders differently, so
 * instead of reverse-engineering each API this harvests the RENDERED product
 * cards across all frames — including cross-origin embed iframes, which
 * Playwright can read. It validates hard (name + real price + a resolvable
 * category) and skips anything low-confidence, so it under-collects rather than
 * writing garbage. Owners refine on claim; admins can bulk-edit.
 *
 * Runs on a workstation / CI (network + Playwright), like the logo scraper —
 * this sandbox can't reach shop sites. Node 22+ (Supabase needs native WS).
 *
 * Usage:
 *   cd apps/web
 *   npx playwright install chromium
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/enrich-dispensary-menus.mjs [--limit 50] [--slug <slug>] [--dry-run]
 *
 * Idempotent: shops that already have products are skipped (override with
 * --refresh to re-harvest). --dry-run reports what it WOULD write.
 */
import { createClient } from '@supabase/supabase-js';

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    console.error('Playwright is required: npx playwright install chromium');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const onlySlug = opt('--slug', null);
const limit = Number(opt('--limit', 50));
const dryRun = flag('--dry-run');
const refresh = flag('--refresh');

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SKIP_DOMAINS = new Set([
  'weedmaps.com', 'leafly.com', 'facebook.com', 'instagram.com', 'twitter.com',
  'x.com', 'tiktok.com', 'linktr.ee', 'linktree.com', 'google.com', 'yelp.com',
]);
const MENU_PATHS = ['', '/menu', '/shop', '/order-online', '/order', '/products', '/store'];

// Category inference: keyword → our category slug. Resolved against the DB's
// category rows so a missing slug just drops the product (never a bad category).
const CATEGORY_KEYWORDS = [
  ['pre-rolls', /pre[-\s]?roll|joint|blunt/i],
  ['vaporizers', /vape|cartridge|cart\b|disposable|pod\b/i],
  ['edibles', /edible|gumm-?|gummy|gummies|chocolate|beverage|drink|mint|lozenge|cookie/i],
  ['concentrates', /concentrate|wax|shatter|rosin|resin|badder|budder|diamond|hash|dab|extract/i],
  ['tinctures', /tincture/i],
  ['topicals', /topical|balm|lotion|salve|cream/i],
  ['accessories', /accessor|battery|grinder|paper|apparel|merch/i],
  ['flower', /flower|bud|eighth|ounce|1\/8|3\.5g|nug|smalls/i],
];

const STRAINS = new Set(['indica', 'sativa', 'hybrid', 'cbd']);
const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

function hostOf(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function dismissAgeGate(page) {
  const res = [/^yes/i, /21(\+| or older| and over)/i, /^enter/i, /^i('| a)m (over )?21/i, /^continue/i, /^agree/i];
  for (const re of res) {
    try {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible({ timeout: 400 })) await btn.click({ timeout: 1200 }).catch(() => {});
    } catch {
      /* none */
    }
  }
}

/** Harvest product-like {name, priceCents, hint} from a single frame's DOM. */
function harvestFrame() {
  const priceRe = /\$\s?(\d{1,4}(?:\.\d{2})?)/;
  const out = [];
  const seen = new Set();
  // Candidate cards: any element that contains a price and isn't huge.
  const all = Array.from(document.querySelectorAll('div,li,article,section,a'));
  for (const el of all) {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 4 || text.length > 240) continue;
    const pm = text.match(priceRe);
    if (!pm) continue;
    // Too many prices → it's a container, not a card.
    if ((text.match(/\$/g) || []).length > 3) continue;
    const price = parseFloat(pm[1]);
    if (!(price >= 1 && price <= 2000)) continue;
    // Name = the card's most prominent short text (heading/strong) or the text
    // before the price.
    let name =
      el.querySelector('h1,h2,h3,h4,strong,[class*="name" i],[class*="title" i]')?.textContent?.trim() ||
      text.split('$')[0].trim();
    name = name.replace(/\s+/g, ' ').slice(0, 120);
    if (name.length < 3 || /add to (cart|bag)|sold out|out of stock/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const thc = text.match(/thc[:\s]*([\d.]{1,5})\s?%/i);
    out.push({ name, priceCents: Math.round(price * 100), hint: text.slice(0, 200), thc: thc ? Number(thc[1]) : null });
    if (out.length >= 120) break;
  }
  return out;
}

function inferCategorySlug(text) {
  for (const [slug, re] of CATEGORY_KEYWORDS) if (re.test(text)) return slug;
  return null;
}
function inferStrain(text) {
  const m = text.toLowerCase().match(/\b(indica|sativa|hybrid|cbd)\b/);
  return m && STRAINS.has(m[1]) ? m[1] : null;
}

async function extractProducts(page, categoryMap) {
  // Scroll to trigger lazy menus, then harvest every frame.
  for (let y = 0; y < 6; y++) {
    await page.mouse.wheel(0, 1600).catch(() => {});
    await page.waitForTimeout(500);
  }
  const rows = [];
  const seen = new Set();
  for (const frame of page.frames()) {
    let found = [];
    try {
      found = await frame.evaluate(harvestFrame);
    } catch {
      continue; // frame detached / unreadable
    }
    for (const p of found) {
      const key = p.name.toLowerCase();
      if (seen.has(key)) continue;
      const catSlug = inferCategorySlug(`${p.name} ${p.hint}`);
      const categoryId = catSlug ? categoryMap.get(catSlug) : null;
      if (!categoryId) continue; // no confident category → skip
      seen.add(key);
      rows.push({
        category_id: categoryId,
        name: p.name,
        slug: slugify(p.name),
        price_cents: p.priceCents,
        strain_type: inferStrain(`${p.name} ${p.hint}`),
        thc_percentage: p.thc != null && p.thc >= 0 && p.thc <= 100 ? p.thc : null,
        in_stock: true,
      });
      if (rows.length >= 80) break;
    }
    if (rows.length >= 80) break;
  }
  // De-dupe by slug (a shop can't have two products with the same slug).
  const bySlug = new Map();
  for (const r of rows) if (!bySlug.has(r.slug)) bySlug.set(r.slug, r);
  return [...bySlug.values()];
}

async function run() {
  const { data: cats } = await supabase.from('categories').select('id,slug,name');
  const categoryMap = new Map();
  for (const c of cats ?? []) {
    categoryMap.set(c.slug.toLowerCase(), c.id);
    categoryMap.set(c.name.toLowerCase(), c.id);
  }

  let q = supabase
    .from('dispensaries')
    .select('id, slug, name, website')
    .eq('status', 'active')
    .not('website', 'is', null);
  if (onlySlug) q = q.eq('slug', onlySlug);
  else q = q.limit(limit);
  const { data: shops, error } = await q;
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36',
  });
  let seeded = 0, skipped = 0, empty = 0;

  for (const shop of shops) {
    const host = hostOf(shop.website);
    if (!host || SKIP_DOMAINS.has(host)) {
      skipped++;
      continue;
    }
    if (!refresh) {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('dispensary_id', shop.id);
      if ((count ?? 0) > 0) {
        skipped++;
        continue;
      }
    }

    let products = [];
    const page = await ctx.newPage();
    try {
      for (const path of MENU_PATHS) {
        try {
          await page.goto(`https://${host}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        } catch {
          continue;
        }
        await dismissAgeGate(page);
        await page.waitForTimeout(1200);
        products = await extractProducts(page, categoryMap);
        if (products.length >= 4) break; // good enough menu found
      }
    } catch (e) {
      console.log(`· ${shop.slug}: ${String(e).slice(0, 70)}`);
    } finally {
      await page.close();
    }

    if (products.length < 4) {
      empty++;
      console.log(`· ${shop.slug}: no confident menu on ${host}`);
      continue;
    }
    if (dryRun) {
      seeded++;
      console.log(`→ ${shop.slug}: ${products.length} products (e.g. ${products.slice(0, 3).map((p) => p.name).join(' | ')})`);
      continue;
    }
    const rows = products.map((p) => ({ dispensary_id: shop.id, ...p }));
    const { error: upErr } = await supabase
      .from('products')
      .upsert(rows, { onConflict: 'dispensary_id,slug' });
    if (upErr) {
      console.log(`· ${shop.slug}: upsert failed — ${upErr.message}`);
      empty++;
      continue;
    }
    seeded++;
    console.log(`✓ ${shop.slug}: seeded ${rows.length} products`);
  }

  await browser.close();
  console.log(`\nDone. seeded=${seeded} skipped=${skipped} empty=${empty}`);
}

run();
