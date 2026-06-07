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
const opts = { dry: argv.includes('--dry'), out: null, set: 'ca' };
const outIdx = argv.indexOf('--out');
if (outIdx >= 0) opts.out = argv[outIdx + 1];
const setIdx = argv.indexOf('--set');
if (setIdx >= 0) opts.set = argv[setIdx + 1]; // 'ca' (default) or 'us' (multi-state additions)

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

// Category word for region-aware descriptions (used by the multi-state set).
const CATWORD = {
  flower: 'flower',
  vape: 'vape & concentrate',
  conc: 'concentrate & extract',
  edible: 'edibles',
  bev: 'beverage',
  preroll: 'pre-roll',
  wellness: 'wellness & tincture',
  multi: '',
};
const buildDesc = (region, cat) =>
  `${region} cannabis ${CATWORD[cat] ? CATWORD[cat] + ' ' : ''}brand.`;

// Multi-state additions: real, recognizable brands beyond the CA set above —
// national/MSO brands plus notable per-state brands. [name, category, region].
// "National" = operates across multiple states. Curated for accuracy, not
// exhaustive (no public brand registry exists).
const BRANDS_US = [
  // ── National / multi-state (incl. MSO house & product brands) ────────────
  ['Cresco', 'flower', 'National'],
  ['Rythm', 'flower', 'National'],
  ['Good Green', 'flower', 'National'],
  ['&Shine', 'flower', 'National'],
  ['High Supply', 'flower', 'National'],
  ['FloraCal', 'flower', 'National'],
  ['Good News', 'edible', 'National'],
  ["Mindy's", 'edible', 'National'],
  ['Beboe', 'vape', 'National'],
  ['incredibles', 'edible', 'National'],
  ['1906', 'edible', 'National'],
  ['Grön', 'edible', 'National'],
  ['Cheeba Chews', 'edible', 'National'],
  ['Bhang', 'edible', 'National'],
  ["Mr. Moxey's", 'edible', 'National'],
  ['District Edibles', 'edible', 'National'],
  ['Dixie Elixirs', 'bev', 'National'],
  ['Dosist', 'vape', 'National'],
  ['Airo', 'vape', 'National'],
  ['O.pen', 'vape', 'National'],
  ['Timeless', 'vape', 'National'],
  ['Buddies', 'conc', 'National'],
  ["Willie's Reserve", 'flower', 'National'],
  ['Binske', 'multi', 'National'],
  ['Curaleaf', 'multi', 'National'],
  ['Grassroots', 'flower', 'National'],
  ['B-Noble', 'vape', 'National'],
  ['Trulieve', 'multi', 'National'],
  ['Roll One', 'flower', 'National'],
  ['Modern Flower', 'flower', 'National'],
  ['Verano', 'multi', 'National'],
  ['Encore', 'edible', 'National'],
  ['Savvy', 'flower', 'National'],
  ['Avexia', 'wellness', 'National'],
  ['MÜV', 'multi', 'National'],
  ['Ayr', 'multi', 'National'],
  ['Kynd', 'flower', 'National'],
  ['Levia', 'bev', 'National'],
  ['Columbia Care', 'multi', 'National'],
  ['Seed & Strain', 'flower', 'National'],
  ['Classix', 'flower', 'National'],
  ['hedy', 'edible', 'National'],
  ['Good Day Farm', 'flower', 'National'],
  ['Minntz', 'flower', 'National'],
  ['Khalifa Kush', 'flower', 'National'],
  ['Runtz', 'flower', 'National'],
  ['Monogram', 'flower', 'National'],
  ['Houseplant', 'flower', 'National'],
  ['Tyson 2.0', 'flower', 'National'],
  // ── Colorado ─────────────────────────────────────────────────────────────
  ['Stratos', 'edible', 'Colorado'],
  ['Coda Signature', 'edible', 'Colorado'],
  ['Dialed In Gummies', 'edible', 'Colorado'],
  ['Robhots', 'edible', 'Colorado'],
  ['Americanna', 'edible', 'Colorado'],
  ['Highly Edible', 'edible', 'Colorado'],
  ['Veritas Fine Cannabis', 'flower', 'Colorado'],
  ['Green Dot Labs', 'conc', 'Colorado'],
  // ── Washington ───────────────────────────────────────────────────────────
  ['Phat Panda', 'flower', 'Washington'],
  ['Fairwinds', 'wellness', 'Washington'],
  ['Avitas', 'vape', 'Washington'],
  ['Mfused', 'vape', 'Washington'],
  // ── Oregon ───────────────────────────────────────────────────────────────
  ['Quill', 'vape', 'Oregon'],
  // ── Michigan ─────────────────────────────────────────────────────────────
  ['Pleasantrees', 'flower', 'Michigan'],
  ['Skymint', 'flower', 'Michigan'],
  ['Common Citizen', 'flower', 'Michigan'],
  // ── Massachusetts ────────────────────────────────────────────────────────
  ['Insa', 'multi', 'Massachusetts'],
  ['Nova Farms', 'flower', 'Massachusetts'],
  ['Fernway', 'vape', 'Massachusetts'],
  ['Garden Remedies', 'multi', 'Massachusetts'],
  // ── Florida ──────────────────────────────────────────────────────────────
  ['Sunburn', 'flower', 'Florida'],
  ['Fluent', 'multi', 'Florida'],
  // ── Nevada ───────────────────────────────────────────────────────────────
  ['Cannavative', 'conc', 'Nevada'],
  ['City Trees', 'vape', 'Nevada'],
  // ── Arizona ──────────────────────────────────────────────────────────────
  ['Aeriz', 'flower', 'Arizona'],
  ['Item 9 Labs', 'multi', 'Arizona'],
  ['Sublime', 'edible', 'Arizona'],
  // ── Illinois ─────────────────────────────────────────────────────────────
  ['Ozone', 'flower', 'Illinois'],
  ['Revolution', 'flower', 'Illinois'],
  // ── California (majors not in the CA set above) ───────────────────────────
  ['Legion of Bloom', 'vape', 'California'],
];

// Round 2 — deeper per-state coverage + more legal states (NY, MO, OH, MD).
// Additive to BRANDS + BRANDS_US (those slugs are reserved before this runs).
const BRANDS_US2 = [
  // ── National / multi-state ───────────────────────────────────────────────
  ['22Red', 'flower', 'National'],
  ['Jaunty', 'vape', 'National'],
  ['Spherex', 'vape', 'National'],
  ['Cherry', 'conc', 'National'],
  ['The Clear', 'vape', 'National'],
  ['Ripple', 'edible', 'National'],
  ['Stillwater', 'edible', 'National'],
  // ── Colorado ─────────────────────────────────────────────────────────────
  ['Lazercat', 'conc', 'Colorado'],
  ['Mountain High Suckers', 'edible', 'Colorado'],
  ['Olio', 'conc', 'Colorado'],
  ['Seed & Smith', 'conc', 'Colorado'],
  // ── Washington ───────────────────────────────────────────────────────────
  ['Dabstract', 'conc', 'Washington'],
  ['Honu', 'edible', 'Washington'],
  ['Gabriel', 'flower', 'Washington'],
  ['Artizen', 'flower', 'Washington'],
  // ── Oregon ───────────────────────────────────────────────────────────────
  ['Serra', 'multi', 'Oregon'],
  ['Pruf Cultivar', 'flower', 'Oregon'],
  ['Drops', 'edible', 'Oregon'],
  ['Lunchbox Alchemy', 'edible', 'Oregon'],
  // ── Michigan ─────────────────────────────────────────────────────────────
  ['Redemption', 'vape', 'Michigan'],
  ['Glorious Cannabis', 'flower', 'Michigan'],
  ['MKX Oil Co', 'conc', 'Michigan'],
  // ── Massachusetts ────────────────────────────────────────────────────────
  ['Theory Wellness', 'multi', 'Massachusetts'],
  ['Berkshire Roots', 'multi', 'Massachusetts'],
  ['Treeworks', 'conc', 'Massachusetts'],
  // ── Florida ──────────────────────────────────────────────────────────────
  ['VidaCann', 'multi', 'Florida'],
  // ── Arizona ──────────────────────────────────────────────────────────────
  ['Mohave Cannabis', 'flower', 'Arizona'],
  ['Grow Sciences', 'conc', 'Arizona'],
  ['Sonoran Roots', 'flower', 'Arizona'],
  // ── New York ─────────────────────────────────────────────────────────────
  ['MFNY', 'flower', 'New York'],
  ['Hepworth', 'flower', 'New York'],
  ['Florist Farms', 'flower', 'New York'],
  // ── Missouri ─────────────────────────────────────────────────────────────
  ['Illicit', 'flower', 'Missouri'],
  ['Proper Cannabis', 'flower', 'Missouri'],
  // ── Ohio ─────────────────────────────────────────────────────────────────
  ['Klutch', 'flower', 'Ohio'],
  ['Buckeye Relief', 'flower', 'Ohio'],
  ['Galenas', 'flower', 'Ohio'],
  // ── Maryland ─────────────────────────────────────────────────────────────
  ['Curio Wellness', 'multi', 'Maryland'],
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
const add = (name, descr) => {
  const slug = slugify(name);
  const key = name.toLowerCase();
  if (seenSlug.has(slug) || seenName.has(key)) return; // dedupe
  seenSlug.add(slug);
  seenName.add(key);
  rows.push(`  (${sqlStr(name)}, ${sqlStr(slug)}, ${sqlStr(descr)})`);
};

let banner;
let stamp;
let file;
if (opts.set === 'us2') {
  // Reserve CA + US slugs so round-2 additions never duplicate them.
  for (const [name] of BRANDS) seenSlug.add(slugify(name));
  for (const [name] of BRANDS_US) seenSlug.add(slugify(name));
  for (const [name, cat, region] of BRANDS_US2) add(name, buildDesc(region, cat));
  banner = [
    '-- Seed: curated real US cannabis consumer brands (round 2).',
    '-- Deeper per-state coverage + more legal states (NY/MO/OH/MD), additive.',
    '-- Hand-curated (no public brand registry exists; not scraped). Unowned.',
    `-- Brands: ${rows.length}`,
    '',
  ].join('\n');
  stamp = '20260607180000';
  file = `${stamp}_seed_us_brands_2.sql`;
} else if (opts.set === 'us') {
  // Reserve the CA-set slugs so multi-state additions never duplicate them.
  for (const [name] of BRANDS) seenSlug.add(slugify(name));
  for (const [name, cat, region] of BRANDS_US) add(name, buildDesc(region, cat));
  banner = [
    '-- Seed: curated real multi-state US cannabis consumer brands.',
    '-- National/MSO + notable per-state brands, additive to the CA brand set.',
    '-- Hand-curated (no public brand registry exists; not scraped). Unowned.',
    `-- Brands: ${rows.length}`,
    '',
  ].join('\n');
  stamp = '20260607170000';
  file = `${stamp}_seed_us_brands.sql`;
} else {
  for (const [name, cat] of BRANDS) add(name, DESC[cat] || DESC.multi);
  banner = [
    '-- Seed: curated real California cannabis consumer brands.',
    '-- Hand-curated (no public brand registry exists; not scraped). Unowned —',
    '-- brand owners can claim and enrich these listings later.',
    `-- Brands: ${rows.length}`,
    '',
  ].join('\n');
  stamp = '20260607160000';
  file = `${stamp}_seed_ca_brands.sql`;
}

const sql = `${banner}insert into public.brands (name, slug, description)
values
${rows.join(',\n')}
on conflict (slug) do nothing;
`;

const outPath = opts.out ?? join(MIGRATIONS_DIR, file);
if (opts.dry) process.stdout.write(sql);
else writeFileSync(outPath, sql);

console.error(`[${opts.set}] ${rows.length} unique brands` + (opts.dry ? ' (dry)' : ` → ${outPath}`));
