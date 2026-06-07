#!/usr/bin/env node
// @ts-nocheck
/**
 * Import licensed cannabis retailers into the `dispensaries` table from an
 * official California license CSV.
 *
 * Works with either column layout out of the box:
 *   - California DCC "Cannabis Unified License Search" export
 *   - Cannlytics `cannabis_licenses` mirror (CC-BY-4.0) of the same DCC data
 *
 * It filters to active storefront retailers (optionally microbusiness /
 * non-storefront), normalizes names/addresses, derives adult-use vs medicinal,
 * de-dupes, generates unique slugs + PostGIS points, and emits an idempotent
 * SQL seed migration (`insert ... on conflict (slug) do nothing`).
 *
 * Usage:
 *   node scripts/import-la-dispensaries.mjs <input.csv> [options]
 *
 * Options:
 *   --city "Los Angeles"        City filter (comma-separated for several). Default: Los Angeles
 *   --any-city                  Do not filter by city (import the whole file)
 *   --include-nonstorefront     Also include delivery-only (non-storefront) retailers
 *   --include-microbusiness     Also include microbusiness licenses (default: on)
 *   --no-microbusiness          Exclude microbusiness licenses
 *   --limit N                   Cap the number of rows written
 *   --out <path>                Output SQL path. Default: a timestamped migration
 *   --dry                       Print SQL to stdout instead of writing a file
 *   --exclude-licenses <file>   Newline-delimited license numbers to skip (already loaded)
 *   --reserved-slugs <file>     Newline-delimited slugs already in use (generated
 *                               slugs avoid these, so incremental imports never collide)
 *
 * Example:
 *   node scripts/import-la-dispensaries.mjs licenses-ca.csv --city "Los Angeles"
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

// ── arg parsing ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = {
  city: 'Los Angeles',
  anyCity: false,
  includeNonStorefront: false,
  microbusiness: true,
  limit: Infinity,
  out: null,
  dry: false,
  excludeLicenses: null,
  reservedSlugs: null,
};
const input = argv.find((a) => !a.startsWith('--'));
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--city') opts.city = argv[++i];
  else if (a === '--any-city') opts.anyCity = true;
  else if (a === '--include-nonstorefront') opts.includeNonStorefront = true;
  else if (a === '--include-microbusiness') opts.microbusiness = true;
  else if (a === '--no-microbusiness') opts.microbusiness = false;
  else if (a === '--limit') opts.limit = Number(argv[++i]);
  else if (a === '--out') opts.out = argv[++i];
  else if (a === '--dry') opts.dry = true;
  else if (a === '--exclude-licenses') opts.excludeLicenses = argv[++i];
  else if (a === '--reserved-slugs') opts.reservedSlugs = argv[++i];
}

// Newline-delimited lists for incremental imports: skip licenses already loaded,
// and reserve slugs already in use so generated slugs never collide with them.
function readList(path) {
  if (!path) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
const excludeLicenses = new Set(readList(opts.excludeLicenses));
const reservedSlugs = readList(opts.reservedSlugs);

if (!input) {
  console.error('Usage: node scripts/import-la-dispensaries.mjs <input.csv> [options]');
  process.exit(1);
}

// ── CSV parsing (RFC 4180) ───────────────────────────────────────────────────
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // ignore
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ── column mapping (tolerant of both DCC + Cannlytics headers) ────────────────
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function makeColumnResolver(header) {
  const index = {};
  header.forEach((h, i) => {
    index[norm(h)] = i;
  });
  return (names) => {
    for (const n of names) {
      const k = norm(n);
      if (k in index) return index[k];
    }
    return -1;
  };
}

const FIELD_NAMES = {
  dba: ['business_dba_name', 'dba', 'doing business as', 'dba name'],
  legal: ['business_legal_name', 'business legal name', 'legal name'],
  license: ['license_number', 'license number', 'license no', 'license'],
  status: ['license_status', 'license status', 'status'],
  type: ['license_type', 'license type', 'type'],
  designation: ['license_designation', 'license designation', 'adult-use/medicinal', 'designation'],
  street: ['premise_street_address', 'premises street address', 'premise address', 'address', 'street address'],
  city: ['premise_city', 'premises city', 'premise city', 'city'],
  state: ['premise_state', 'premises state', 'premise state', 'state'],
  zip: ['premise_zip_code', 'premises zip code', 'premise zip', 'zip code', 'zip', 'postal code'],
  phone: ['business_phone', 'business phone', 'phone'],
  website: ['business_website', 'business website', 'website'],
  email: ['business_email', 'business email', 'email'],
  lat: ['premise_latitude', 'latitude', 'lat'],
  lng: ['premise_longitude', 'longitude', 'lng', 'long'],
};

// ── value normalization ──────────────────────────────────────────────────────
const NULLISH = new Set(['', 'data not available', 'n/a', 'na', 'none', 'null']);
function clean(v) {
  const t = String(v ?? '').trim();
  return NULLISH.has(t.toLowerCase()) ? null : t;
}
function titleCase(v) {
  if (!v) return v;
  return v
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Llc|Inc|Co|Dba)\b/g, (m) => m.toUpperCase())
    .replace(/'([A-Z])/g, (m, c) => "'" + c.toLowerCase());
}
function normalizeWebsite(v) {
  const t = clean(v);
  if (!t || !/\.[a-z]{2,}/i.test(t)) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}
function normalizeEmail(v) {
  const t = clean(v);
  return t && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t.toLowerCase() : null;
}
function normalizeZip(v) {
  const t = clean(v);
  const m = t && t.match(/\d{5}/);
  return m ? m[0] : null;
}
function parseCoord(v, min, max) {
  const n = Number(clean(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function slugify(v) {
  return v
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

// ── main ─────────────────────────────────────────────────────────────────────
const rows = parseCSV(readFileSync(input, 'utf8'));
if (rows.length < 2) {
  console.error('No data rows found in CSV.');
  process.exit(1);
}
const header = rows[0];
const col = makeColumnResolver(header);
const idx = Object.fromEntries(Object.entries(FIELD_NAMES).map(([k, names]) => [k, col(names)]));
if (idx.license === -1 || idx.city === -1 || idx.street === -1) {
  console.error('CSV missing required columns (license number / city / street address).');
  console.error('Detected headers:', header.join(', '));
  process.exit(1);
}

const cityFilter = new Set(opts.city.split(',').map((c) => norm(c)));
const stats = { total: 0, notRetailer: 0, inactive: 0, wrongCity: 0, noName: 0, noLocation: 0, excluded: 0, dupLicense: 0, dupSlug: 0, kept: 0 };
const seenLicense = new Set();
const seenSlug = new Set(reservedSlugs); // reserved → generated slugs avoid them
const records = [];

for (const r of rows.slice(1)) {
  if (r.length === 1 && r[0] === '') continue;
  stats.total++;
  const get = (k) => (idx[k] >= 0 ? r[idx[k]] : '');

  const type = (clean(get('type')) ?? '').toLowerCase();
  const isRetail = type.includes('retail');
  const isMicro = type.includes('microbusiness');
  const isNonStore = type.includes('nonstorefront') || type.includes('non-storefront');
  if (!((isRetail && (opts.includeNonStorefront || !isNonStore)) || (isMicro && opts.microbusiness))) {
    stats.notRetailer++;
    continue;
  }

  const status = (clean(get('status')) ?? '').toLowerCase();
  if (!status.includes('active')) {
    stats.inactive++;
    continue;
  }

  if (!opts.anyCity && !cityFilter.has(norm(get('city')))) {
    stats.wrongCity++;
    continue;
  }

  let name = titleCase(clean(get('dba')) ?? clean(get('legal')) ?? '');
  const legalName = titleCase(clean(get('legal')) ?? '');
  const legalOk = legalName.length >= 2 && legalName.length <= 120;
  // Schema requires 2 ≤ char_length(name) ≤ 120. Some DCC DBA fields are junk
  // ("_", ".") or concatenate many DBAs (>120). Prefer the legal name in those
  // cases; otherwise truncate. Drop the row only if no usable name remains.
  if ((name.length < 2 || name.length > 120) && legalOk) {
    name = legalName;
  } else if (name.length > 120) {
    name = name.slice(0, 120).trim();
  }
  if (name.length < 2) {
    stats.noName++;
    continue;
  }

  // `location` is NOT NULL in the schema and a listing needs a map point — drop
  // records without valid premise coordinates rather than emit a broken insert.
  const lat = parseCoord(get('lat'), 32, 42);
  const lng = parseCoord(get('lng'), -125, -114);
  if (lat == null || lng == null) {
    stats.noLocation++;
    continue;
  }

  const license = clean(get('license'));
  if (license && excludeLicenses.has(license)) {
    stats.excluded++;
    continue;
  }
  if (license && seenLicense.has(license)) {
    stats.dupLicense++;
    continue;
  }
  if (license) seenLicense.add(license);

  let slug = slugify(name) || slugify(license ?? 'dispensary');
  if (seenSlug.has(slug)) {
    const cityPart = slugify(clean(get('city')) ?? '');
    let candidate = cityPart ? `${slug}-${cityPart}` : slug;
    let n = 2;
    while (seenSlug.has(candidate)) candidate = `${slug}-${n++}`;
    slug = candidate;
  }
  seenSlug.add(slug);

  const designation = (clean(get('designation')) ?? '').toLowerCase();

  records.push({
    name,
    slug,
    address: titleCase(clean(get('street'))) ?? '',
    city: titleCase(clean(get('city'))) ?? '',
    state: (clean(get('state')) ?? 'CA').toUpperCase().slice(0, 2),
    zip: normalizeZip(get('zip')) ?? '',
    phone: clean(get('phone')),
    email: normalizeEmail(get('email')),
    website: normalizeWebsite(get('website')),
    license_number: license,
    is_medical: designation ? /medic/.test(designation) : true,
    is_recreational: designation ? /adult/.test(designation) : true,
    is_delivery: isNonStore,
    is_pickup: !isNonStore,
    latitude: lat,
    longitude: lng,
  });
  stats.kept++;
  if (records.length >= opts.limit) break;
}

// ── SQL generation ───────────────────────────────────────────────────────────
const sqlStr = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const sqlNum = (v) => (v == null ? 'null' : String(v));
const sqlBool = (v) => (v ? 'true' : 'false');

const valueRows = records.map((d) => {
  // `location` is the source of truth; latitude/longitude are STORED generated
  // columns (ST_Y/ST_X of location) and must NOT be written to directly.
  const location = `'SRID=4326;POINT(${d.longitude} ${d.latitude})'::geography`;
  return (
    `  (${sqlStr(d.name)}, ${sqlStr(d.slug)}, ${sqlStr(d.address)}, ${sqlStr(d.city)}, ` +
    `${sqlStr(d.state)}, ${sqlStr(d.zip)}, ${sqlStr(d.phone)}, ${sqlStr(d.email)}, ` +
    `${sqlStr(d.website)}, ${sqlStr(d.license_number)}, ${sqlBool(d.is_medical)}, ` +
    `${sqlBool(d.is_recreational)}, ${sqlBool(d.is_delivery)}, ${sqlBool(d.is_pickup)}, ` +
    `${location}, 'active')`
  );
});

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const banner = [
  '-- Seed: real licensed California cannabis retailers.',
  `-- Generated by scripts/import-la-dispensaries.mjs from ${input}`,
  '-- Source: California Department of Cannabis Control public license data',
  '--   (mirrored by Cannlytics under CC-BY-4.0). Public record / attribution.',
  `-- Filter: ${opts.anyCity ? 'all cities' : `city in [${opts.city}]`}, active retailers` +
    `${opts.microbusiness ? ' + microbusiness' : ''}${opts.includeNonStorefront ? ' + non-storefront' : ''}.`,
  `-- Records: ${records.length}`,
  '',
].join('\n');

const sql =
  records.length === 0
    ? `${banner}-- No matching records.\n`
    : `${banner}insert into public.dispensaries
  (name, slug, address, city, state, zip, phone, email, website, license_number,
   is_medical, is_recreational, is_delivery, is_pickup, location, status)
values
${valueRows.join(',\n')}
on conflict (slug) do nothing;
`;

const outPath = opts.out ?? join(MIGRATIONS_DIR, `${stamp}_seed_la_dispensaries.sql`);
if (opts.dry) {
  process.stdout.write(sql);
} else {
  writeFileSync(outPath, sql);
}

console.error(
  `\nParsed ${stats.total} rows → kept ${stats.kept}\n` +
    `  skipped: ${stats.notRetailer} non-retailer, ${stats.inactive} inactive, ` +
    `${stats.wrongCity} other-city, ${stats.noName} no-name, ${stats.noLocation} no-location, ` +
    `${stats.excluded} excluded, ${stats.dupLicense} dup-license, ${stats.dupSlug} dup-slug\n` +
    (opts.dry ? '  (dry run — SQL written to stdout)' : `  → ${outPath}`),
);
