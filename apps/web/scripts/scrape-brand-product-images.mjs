#!/usr/bin/env node
/**
 * Backfill brand_products.image_url (and missing brand websites/logos) by
 * visiting each brand's own site with a real browser. Brand sites age-gate and
 * bot-block cloud fetchers, so this runs on a workstation with Playwright.
 *
 * For each brand: open its website (discovering it via DuckDuckGo when the DB
 * has none), click through the age gate, walk product/shop pages, harvest
 * product-name → image pairs, fuzzy-match them against the brand's catalog
 * rows, and write image URLs back. Images render on the site through the
 * /api/brand-product-image proxy, so external hosts never hit visitors' CSP.
 *
 * Usage:
 *   cd apps/web
 *   npx playwright install chromium   # once
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/scrape-brand-product-images.mjs [--brand <slug>] [--limit 25]
 *
 * Idempotent: brands whose products all have images are skipped.
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
  console.error('Playwright is required: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const args = process.argv.slice(2);
const onlySlug = args.includes('--brand') ? args[args.indexOf('--brand') + 1] : null;
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 50;

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const norm = (s) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1);

function matchScore(a, b) {
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared / Math.min(ta.size, tb.size);
}

async function dismissAgeGate(page) {
  const patterns = [/^yes/i, /21(\+| or older| and over)/i, /^enter/i, /^i('| a)m (over )?21/i, /^continue/i, /^agree/i];
  for (const re of patterns) {
    try {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible({ timeout: 600 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(800);
        return;
      }
    } catch { /* try next pattern */ }
  }
}

/** Product-name → best image URL pairs from whatever framework the site uses. */
async function harvestPage(page) {
  return page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const img of document.querySelectorAll('img')) {
      const src = img.currentSrc || img.src;
      if (!src || !src.startsWith('https://') || seen.has(src)) continue;
      if (img.naturalWidth > 0 && img.naturalWidth < 120) continue; // icons
      // Name candidates: alt text, then the nearest heading/product-title text.
      let name = (img.alt || '').trim();
      if (name.length < 3) {
        const card = img.closest('a, li, article, [class*="product" i], [class*="card" i]');
        const title = card?.querySelector('h1,h2,h3,h4,[class*="title" i],[class*="name" i]');
        name = (title?.textContent || '').trim();
      }
      if (name.length < 3 || name.length > 120) continue;
      seen.add(src);
      out.push({ name, src });
    }
    return out;
  });
}

async function discoverWebsite(page, brandName) {
  await page.goto(
    `https://duckduckgo.com/html/?q=${encodeURIComponent(`${brandName} cannabis brand official site`)}`,
    { waitUntil: 'domcontentloaded', timeout: 30000 },
  );
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a.result__a')].slice(0, 5).map((a) => a.href),
  );
  const skip = /weedmaps|leafly|instagram|facebook|linkedin|wikipedia|yelp|dutchie|iheartjane/i;
  return links.find((u) => !skip.test(u)) ?? null;
}

const { data: brands } = await supabase
  .from('brands')
  .select('id,slug,name,website,logo_url, brand_products(id,name,image_url)')
  .order('name');

let updatedImages = 0;
let updatedBrands = 0;
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const brand of brands ?? []) {
  if (onlySlug && brand.slug !== onlySlug) continue;
  const missing = (brand.brand_products ?? []).filter((p) => !p.image_url);
  if (missing.length === 0) continue;
  if (updatedBrands >= limit) break;

  let site = brand.website;
  try {
    if (!site) {
      site = await discoverWebsite(page, brand.name);
      if (site) {
        const domain = new URL(site).hostname.replace(/^www\./, '');
        await supabase
          .from('brands')
          .update({
            website: site,
            ...(brand.logo_url
              ? {}
              : { logo_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` }),
          })
          .eq('id', brand.id);
        console.log(`site  ${brand.name} → ${site}`);
      } else {
        console.log(`skip  ${brand.name} — no site found`);
        continue;
      }
    }

    await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissAgeGate(page);

    // The homepage plus up to 4 catalog-ish internal pages.
    const productLinks = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.href)
        .filter((h) => /product|shop|strain|menu|flower|collection/i.test(h))
        .filter((h, i, arr) => arr.indexOf(h) === i)
        .slice(0, 4),
    );

    let pairs = await harvestPage(page);
    for (const link of productLinks) {
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await dismissAgeGate(page);
        pairs = pairs.concat(await harvestPage(page));
      } catch { /* keep what we have */ }
    }

    let brandHits = 0;
    for (const product of missing) {
      let best = null;
      for (const pair of pairs) {
        const score = matchScore(product.name, pair.name);
        if (score >= 0.6 && (!best || score > best.score)) best = { ...pair, score };
      }
      if (best) {
        await supabase.from('brand_products').update({ image_url: best.src }).eq('id', product.id);
        updatedImages += 1;
        brandHits += 1;
      }
    }
    console.log(`ok    ${brand.name}: ${brandHits}/${missing.length} images matched`);
    if (brandHits > 0) updatedBrands += 1;
  } catch (e) {
    console.log(`fail  ${brand.name}: ${e.message?.slice(0, 100)}`);
  }
}

await browser.close();
console.log(`Done. ${updatedImages} product images written across ${updatedBrands} brands.`);
