# Dispensary importer

`import-la-dispensaries.mjs` turns an official **California cannabis license CSV**
into an idempotent SQL seed migration for the `dispensaries` table.

## Why this source (and not Weedmaps)

We do **not** scrape Weedmaps / Leafly / other directories — their listings are
proprietary aggregations and scraping them violates their terms. Instead we use
**public-record government licensing data** from the California Department of
Cannabis Control (DCC), which is free to use and authoritative.

The importer accepts either column layout with no changes:

- **CA DCC** "Cannabis Unified License Search" export (<https://search.cannabis.ca.gov>)
- **Cannlytics** [`cannabis_licenses`](https://huggingface.co/datasets/cannlytics/cannabis_licenses)
  mirror of the same DCC data, released under **CC-BY-4.0** (attribution kept in
  the generated migration's header).

## Getting the CSV

> ℹ️ Claude Code's web sandbox is network-restricted (egress allowlist) and
> currently **cannot reach** `search.cannabis.ca.gov`, `data.ca.gov`, or
> `huggingface.co` directly. Download the CSV on an unrestricted machine (or
> widen the environment's network policy), then place it somewhere this script
> can read it.

Options:

1. **DCC search** → filter to retailers → **Export** to CSV.
2. **Cannlytics dataset** → open the `ca` config and download it as CSV/Parquet
   (convert Parquet → CSV if needed).

## Usage

```bash
# from packages/supabase
pnpm import:dispensaries <input.csv> [options]

# examples
pnpm import:dispensaries licenses-ca.csv                 # active LA retailers + microbusiness
pnpm import:dispensaries licenses-ca.csv --dry           # print SQL, don't write
pnpm import:dispensaries licenses-ca.csv --city "Los Angeles,Long Beach,West Hollywood"
pnpm import:dispensaries licenses-ca.csv --include-nonstorefront
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--city "A,B"` | `Los Angeles` | City filter (comma-separated) |
| `--any-city` | off | Import every city in the file |
| `--include-nonstorefront` | off | Also include delivery-only retailers |
| `--no-microbusiness` | off | Exclude microbusiness licenses |
| `--limit N` | ∞ | Cap rows written |
| `--out <path>` | timestamped migration | Output SQL file |
| `--dry` | off | Print SQL to stdout instead of writing |

By default it writes `supabase/migrations/<timestamp>_seed_la_dispensaries.sql`.

## What it does

- Keeps only **active** storefront **retailer** (and microbusiness) licenses.
- Normalizes names (DBA → legal fallback), addresses, ZIP, phone, website, email;
  treats `"Data Not Available"` as null.
- Derives `is_recreational` / `is_medical` from the license designation.
- De-dupes by license number, generates **unique slugs**, and builds a
  `POINT(lng lat)` PostGIS `location` from the premise coordinates.
- Emits `insert ... on conflict (slug) do nothing`, so re-running is safe.

## Apply

```bash
pnpm db:push        # or run the generated migration via your normal flow
```

Imported listings have `owner_id = null` (unclaimed). Owners fill in hours,
photos, menus, etc. via the dashboard after claiming — none of that proprietary
content is scraped.

## Test

```bash
node scripts/import-la-dispensaries.mjs scripts/__fixtures__/sample-licenses.csv --dry
```

The fixture exercises city/type/status filtering, name fallback, dedupe, and
slug collisions.
