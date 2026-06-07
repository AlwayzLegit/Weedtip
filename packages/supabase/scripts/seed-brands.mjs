#!/usr/bin/env node
// @ts-nocheck
/**
 * Generate a seed migration for the `brands` table from a curated list of
 * well-known, real California cannabis consumer brands.
 *
 * Why curated (not scraped / not derived from licenses): there is no public
 * registry of consumer cannabis *brands*. Brands aren't licensed by name, and
 * clean brand lists only exist on directories like Weedmaps/Leafly, which we
 * don't scrape. Public lab-COA data only exposes the licensed *manufacturer*
 * (legal entity), not the shopper-facing brand. So this is a hand-curated set
 * of recognizable brands that operate in California's legal market.
 *
 * Descriptions are intentionally category-level (not specific claims) to stay
 * accurate. Listings are unowned; brand owners can claim + enrich later.
 *
 * Usage:
 *   node scripts/seed-brands.mjs            # write timestamped migration
 *   node scripts/seed-brands.mjs --dry      # print SQL to stdout
 *   node scripts/seed-brands.mjs --out <p>  # custom output path
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

const argv = process.argv.slice(2);
const opts = { dry: argv.includes('--dry'), out: null };
const outIdx = argv.indexOf('--out');
if (outIdx >= 0) opts.out = argv[outIdx + 1];

// Category → safe, generic description.
const DESC = {
  flower: 'California cannabis flower brand.',
  vape: 'California cannabis vape & concentrate brand.',
  conc: 'California cannabis concentrate & extract brand.',
  edible: 'California cannabis edibles brand.',
  bev: 'California cannabis beverage brand.',
  preroll: 'California cannabis pre-roll brand.',
  wellness: 'California cannabis wellness & tincture brand.',
  multi: 'California cannabis brand.',
};

// Curated list: [name, category]. Real, established CA-market brands.
const BRANDS = [
  // ── Flower ──────────────────────────────────────────────────────────────
  ['Connected Cannabis Co.', 'flower'],
  ['Alien Labs', 'flower'],
  ['Jungle Boys', 'flower'],
  ['Wonderbrett', 'flower'],
  ['Sherbinskis', 'flower'],
  ['Backpack Boyz', 'flower'],
  ['Lemonnade', 'flower'],
  ['Cookies', 'flower'],
  ['Glass House Farms', 'flower'],
  ['Pacific Stone', 'flower'],
  ['Lowell Farms', 'flower'],
  ['Claybourne Co.', 'flower'],
  ['Cream of the Crop', 'flower'],
  ['Almora Farm', 'flower'],
  ['Fig Farms', 'flower'],
  ['Maven Genetics', 'flower'],
  ['Source Cannabis', 'flower'],
  ["Henry's Original", 'flower'],
  ['Flow Kana', 'flower'],
  ['Coastal Sun Farm', 'flower'],
  ['Sonoma Hills Farm', 'flower'],
  ['Aster Farms', 'flower'],
  ['Ball Family Farms', 'flower'],
  ['Pure Beauty', 'flower'],
  ['Cypress Cannabis', 'flower'],
  ['Grandiflora', 'flower'],
  ["Humboldt's Finest", 'flower'],
  ['Humboldt Farms', 'flower'],
  ['Nug', 'flower'],
  ['Stone Road', 'flower'],
  ['Allswell', 'flower'],
  ['Pacific Reserve', 'flower'],
  ['Local Cannabis Co.', 'flower'],
  ['Emerald Spirit Botanicals', 'flower'],
  ['Gelato', 'flower'],
  ['THC Design', 'flower'],
  ['The Growers Circle', 'flower'],
  ['Field Extracts', 'conc'],
  // ── Vape / Concentrate ──────────────────────────────────────────────────
  ['Stiiizy', 'vape'],
  ['Raw Garden', 'conc'],
  ['Heavy Hitters', 'vape'],
  ['Select', 'vape'],
  ['Rove', 'vape'],
  ['PLUGplay', 'vape'],
  ['Friendly Farms', 'vape'],
  ['AbsoluteXtracts', 'vape'],
  ['Beezle Extracts', 'conc'],
  ['710 Labs', 'conc'],
  ['Jetty Extracts', 'vape'],
  ['West Coast Cure', 'vape'],
  ['Kurvana', 'vape'],
  ['Bloom Brands', 'vape'],
  ['Cannabiotix', 'flower'],
  ['Moxie', 'conc'],
  ['Guild Extracts', 'conc'],
  ['Pure Vape', 'vape'],
  ['Korova', 'flower'],
  ['Dabwoods', 'vape'],
  ['710 Kingpen', 'vape'],
  ['Loudpack', 'flower'],
  ["Papa's Select", 'conc'],
  ['Dime Industries', 'vape'],
  ['Dompen', 'vape'],
  ['Litto', 'vape'],
  ['Eureka', 'vape'],
  ['Packwoods', 'preroll'],
  // ── Edibles / Beverages / Wellness ───────────────────────────────────────
  ['Wyld', 'edible'],
  ['Kiva', 'edible'],
  ['Camino', 'edible'],
  ['Petra', 'edible'],
  ['Lost Farm', 'edible'],
  ['Kanha', 'edible'],
  ['Wana Brands', 'edible'],
  ['PLUS Products', 'edible'],
  ['Papa & Barkley', 'wellness'],
  ["Mary's Medicinals", 'wellness'],
  ['Yummi Karma', 'wellness'],
  ['Froot', 'edible'],
  ['Smokiez Edibles', 'edible'],
  ['Punch Edibles', 'edible'],
  ['Breez', 'wellness'],
  ['Cann', 'bev'],
  ['Keef', 'bev'],
  ['Pabst Labs', 'bev'],
  ["Uncle Arnie's", 'bev'],
  ['Lord Jones', 'edible'],
  ['Garden Society', 'edible'],
  ['Hervé', 'edible'],
  ["Dr. Norm's", 'edible'],
  ['Kikoko', 'bev'],
  ['Care By Design', 'wellness'],
  // ── Pre-rolls / Other ────────────────────────────────────────────────────
  ['Jeeter', 'preroll'],
  ['El Blunto', 'preroll'],
  ['Space Coyote', 'preroll'],
  ['Drew Martin', 'preroll'],
  ['Dogwalkers', 'preroll'],
  ['Caliva', 'multi'],
  ['Fun Uncle', 'vape'],
  ['Old Pal', 'flower'],
];

const slugify = (v) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (Hervé → Herve)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

const sqlStr = (v) => `'${String(v).replace(/'/g, "''")}'`;

const seenSlug = new Set();
const seenName = new Set();
const rows = [];
for (const [name, cat] of BRANDS) {
  const slug = slugify(name);
  const key = name.toLowerCase();
  if (seenSlug.has(slug) || seenName.has(key)) continue; // dedupe
  seenSlug.add(slug);
  seenName.add(key);
  rows.push(`  (${sqlStr(name)}, ${sqlStr(slug)}, ${sqlStr(DESC[cat] || DESC.multi)})`);
}

const banner = [
  '-- Seed: curated real California cannabis consumer brands.',
  '-- Hand-curated (no public brand registry exists; not scraped). Unowned —',
  '-- brand owners can claim and enrich these listings later.',
  `-- Brands: ${rows.length}`,
  '',
].join('\n');

const sql = `${banner}insert into public.brands (name, slug, description)
values
${rows.join(',\n')}
on conflict (slug) do nothing;
`;

const stamp = '20260607160000';
const outPath = opts.out ?? join(MIGRATIONS_DIR, `${stamp}_seed_ca_brands.sql`);
if (opts.dry) process.stdout.write(sql);
else writeFileSync(outPath, sql);

console.error(`Curated ${BRANDS.length} entries → ${rows.length} unique brands` + (opts.dry ? ' (dry)' : ` → ${outPath}`));
