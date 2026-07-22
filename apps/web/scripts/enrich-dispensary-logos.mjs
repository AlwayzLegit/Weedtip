#!/usr/bin/env node
/**
 * Pull each dispensary's REAL logo from its own website and store it in Supabase,
 * so listings show the shop's mark instead of a generic/derived favicon.
 *
 * Why a workstation script and not a server route: dispensary sites age-gate and
 * bot-block cloud fetchers (same reason scrape-brand-product-images.mjs runs
 * locally), and the app's CSP only allows images from Supabase/Mapbox/Google —
 * so a scraped logo has to be uploaded into the public `dispensary-media` bucket
 * and referenced by its Supabase URL, not linked hot from the shop's domain.
 *
 * For each candidate dispensary it opens the website, dismisses the age gate,
 * and picks the best logo in priority order:
 *   1. a header <img> whose class/alt/src says "logo"
 *   2. <link rel="apple-touch-icon"> (largest) — usually the brand mark
 *   3. og:image (last resort; often a banner, so lowest priority)
 *   4. a high-res <link rel="icon" sizes="…"> (>= 48px; never the 16/32 favicon)
 * then downloads it, uploads to dispensary-media/logos/<slug>.<ext>, and sets
 * dispensaries.logo_url to the public Supabase URL.
 *
 * Third-party/aggregator and social domains (Weedmaps, Dutchie, Leafly,
 * Facebook, Instagram, Linktree, …) are SKIPPED — their favicon is not the
 * shop's logo (that's the mess this cleans up). Shops on those domains keep a
 * null logo and fall back to the app's placeholder.
 *
 * Usage:
 *   cd apps/web
 *   npx playwright install chromium            # once
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/enrich-dispensary-logos.mjs [--limit 100] [--slug <slug>] [--dry-run] [--refresh]
 *
 * Idempotent: skips shops whose logo_url is already a Supabase URL unless
 * --refresh is passed. --dry-run reports the logo it WOULD set without writing.
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
    // @playwright/test (a repo devDependency) re-exports the browser launchers.
    ({ chromium } = await import('@playwright/test'));
  } catch {
    console.error('Playwright is required: pnpm add -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const onlySlug = opt('--slug', null);
const limit = Number(opt('--limit', 100));
const dryRun = flag('--dry-run');
const refresh = flag('--refresh');

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const BUCKET = 'dispensary-media';

// Domains whose favicon/logo is NOT the shop's own mark — skip entirely.
const SKIP_DOMAINS = new Set([
  'weedmaps.com', 'dutchie.com', 'leafly.com', 'iheartjane.com', 'jane.com',
  'allbud.com', 'potguide.com', 'wheresweed.com', 'leaflink.com', 'getmeadow.com',
  'meadow.com', 'tymber.io', 'sweed.io', 'blaze.me', 'greenrush.com', 'dispenseapp.com',
  'webjoint.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
  'linktr.ee', 'linktree.com', 'beacons.ai', 'snapchat.com', 'youtube.com',
  'google.com', 'sites.google.com', 'business.site', 'bit.ly', 'yelp.com',
]);

function hostOf(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function dismissAgeGate(page) {
  const patterns = [/^yes/i, /21(\+| or older| and over)/i, /^enter/i, /^i('| a)m (over )?21/i, /^continue/i, /^agree/i];
  for (const re of patterns) {
    try {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click({ timeout: 1500 }).catch(() => {});
      }
    } catch {
      /* no gate */
    }
  }
}

/** Find the best logo URL on the current page, absolute. */
async function findLogo(page) {
  return page.evaluate(() => {
    const abs = (u) => {
      try {
        return new URL(u, location.href).href;
      } catch {
        return null;
      }
    };
    // 1. Header <img> that looks like a logo.
    const imgs = [...document.querySelectorAll('header img, [class*="header" i] img, [class*="nav" i] img, img')];
    for (const img of imgs) {
      const hay = `${img.className} ${img.alt} ${img.src} ${img.id}`.toLowerCase();
      if (/logo|brand|wordmark/.test(hay) && img.currentSrc) {
        const w = img.naturalWidth || img.width || 0;
        if (w >= 40) return abs(img.currentSrc);
      }
    }
    // 2. apple-touch-icon (largest).
    const touch = [...document.querySelectorAll('link[rel~="apple-touch-icon" i]')]
      .map((l) => ({ href: l.getAttribute('href'), size: parseInt(l.getAttribute('sizes')) || 0 }))
      .filter((l) => l.href)
      .sort((a, b) => b.size - a.size)[0];
    if (touch) return abs(touch.href);
    // 3. og:image (last resort — often a banner).
    const og = document.querySelector('meta[property="og:image" i]')?.getAttribute('content');
    // 4. sizeable rel=icon (skip the 16/32 favicon).
    const icon = [...document.querySelectorAll('link[rel~="icon" i]')]
      .map((l) => ({ href: l.getAttribute('href'), size: parseInt(l.getAttribute('sizes')) || 0 }))
      .filter((l) => l.href && l.size >= 48)
      .sort((a, b) => b.size - a.size)[0];
    if (icon) return abs(icon.href);
    return og ? abs(og) : null;
  });
}

const extFromType = (ct) =>
  ct?.includes('png') ? 'png' : ct?.includes('svg') ? 'svg' : ct?.includes('webp') ? 'webp' : ct?.includes('x-icon') || ct?.includes('vnd.microsoft.icon') ? 'ico' : 'jpg';

async function run() {
  let q = supabase
    .from('dispensaries')
    .select('id, slug, name, website, logo_url')
    .eq('status', 'active')
    .not('website', 'is', null);
  if (onlySlug) q = q.eq('slug', onlySlug);
  else {
    // Prefer shops with no logo; --refresh also revisits favicon-derived ones.
    q = refresh
      ? q.or('logo_url.is.null,logo_url.like.%s2/favicons%')
      : q.is('logo_url', null);
    q = q.limit(limit);
  }
  const { data: shops, error } = await q;
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  console.log(`${shops.length} candidate dispensaries${dryRun ? ' (dry run)' : ''}`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36' });
  let set = 0, skipped = 0, missed = 0;

  for (const shop of shops) {
    const host = hostOf(shop.website);
    if (!host || SKIP_DOMAINS.has(host)) {
      skipped++;
      continue;
    }
    if (!refresh && shop.logo_url?.includes('.supabase.co')) {
      skipped++;
      continue;
    }
    const page = await ctx.newPage();
    try {
      await page.goto(`https://${host}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await dismissAgeGate(page);
      await page.waitForTimeout(800);
      const logoUrl = await findLogo(page);
      if (!logoUrl) {
        missed++;
        console.log(`· ${shop.slug}: no logo found on ${host}`);
        continue;
      }
      if (dryRun) {
        set++;
        console.log(`→ ${shop.slug}: ${logoUrl}`);
        continue;
      }
      // Download + upload to Supabase storage.
      const res = await page.request.get(logoUrl, { timeout: 15000 });
      if (!res.ok()) {
        missed++;
        continue;
      }
      const ct = res.headers()['content-type'] || '';
      if (!ct.startsWith('image')) {
        missed++;
        continue;
      }
      const buf = await res.body();
      if (buf.length < 300 || buf.length > 2_000_000) {
        missed++;
        continue;
      }
      const path = `logos/${shop.slug}.${extFromType(ct)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, buf, {
        contentType: ct,
        upsert: true,
      });
      if (up.error) {
        console.log(`· ${shop.slug}: upload failed — ${up.error.message}`);
        missed++;
        continue;
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await supabase.from('dispensaries').update({ logo_url: pub.publicUrl }).eq('id', shop.id);
      set++;
      console.log(`✓ ${shop.slug}: ${pub.publicUrl}`);
    } catch (e) {
      missed++;
      console.log(`· ${shop.slug}: ${String(e).slice(0, 80)}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nDone. set=${set} skipped=${skipped} missed=${missed}`);
}

run();
