# Nationwide Dispensary Ingest — local session runbook

## Goal

Populate `dispensaries` with licensed retail dispensaries across the US (registries-first,
licensed-only), then enrich with Google. This runs in a **local session with open outbound
network and a Google Places key** — the cloud/remote session this doc was written from has
network egress locked to an allowlist (package registries only) and no
`GOOGLE_PLACES_API_KEY`, so the fetch + enrich steps cannot run there.

## Context (what already exists)

- Repo: `AlwayzLegit/Weedtip` (pnpm monorepo). DB: Supabase project ref
  **`ggpnghpcclngqkyelkes`** (`weedtip-prod`).
- Current data: **1,539 CA** dispensaries (from CA's DCC registry) + 1 NY demo shop. Effectively
  CA-only today.
- `operating_regions` is already seeded with per-state legality for all 50 states (used for
  compliance gating — see `packages/supabase/supabase/seed.sql`).
- Pipeline scripts live in `packages/supabase/scripts/`:
  - `import-la-dispensaries.mjs` — imports a license CSV → an idempotent migration SQL file.
    Already tolerant of both the CA-DCC export layout **and** the Cannlytics
    `cannabis_licenses` layout. State-agnostic except the retail-type filter (see Step 3).
  - `geocode-ca-licenses.py` — fills missing lat/lng via the **free US Census batch geocoder**
    (no API key; works for any US address despite the CA-specific filename).
  - `enrich-from-google.py` — fills phone/website/hours + `google_place_id` from Google Places
    (Text Search, New). State-agnostic — operates on whatever is in the DB. ~$0.03–0.04/shop.
  - `gen-place-photos.py` — storefront photos. Stores only the Google photo *reference*
    (`google_photo_name`); the image itself is served live via `/api/dispensary-cover` (Places
    ToS compliant). ~$0.017/shop.
  - `gen-dispensary-logos.py` — logos from the shop's website-domain favicon (Google S2, free,
    no key).

### What's NOT built

Only `fetch-ca-licenses.py` exists as a per-state fetcher (hits CA's DCC API directly). There is
no single nationwide licensed-dispensary API, and no fetcher exists for other states.
**Use the Cannlytics `cannabis_licenses` dataset instead of building ~24 state fetchers** — it's
a CC-BY-4.0 aggregation of state license registries already in a layout the importer
understands.

## Prerequisites (set these locally)

```bash
git clone <repo-url> && cd Weedtip
git checkout claude/nationwide-ingest-handoff   # has this doc + the exports below
pnpm install
pip install requests pandas            # for the python scripts

export GOOGLE_PLACES_API_KEY=...        # same key that's set in Vercel prod
# From Supabase dashboard → Project Settings → API / Database (project ref ggpnghpcclngqkyelkes):
export SB_URL=https://ggpnghpcclngqkyelkes.supabase.co
export SB_ANON=...                      # anon key — used by the python enrich scripts for reads
export SB_DB_URL=...                    # Postgres connection string — used to apply migration SQL
```

## Already exported for you

To avoid re-importing/colliding with the 1,539 dispensaries already loaded, this branch includes
a live snapshot of current slugs and license numbers:

```
packages/supabase/scripts/seed-exports/existing-slugs.txt      (1,539 lines)
packages/supabase/scripts/seed-exports/existing-licenses.txt   (1,539 lines)
```

Pass these straight into the importer's `--reserved-slugs` / `--exclude-licenses` flags (Step 3)
— no need to re-query the DB before you start. If you run multiple import batches in one
session, regenerate them between batches so later states don't collide with earlier ones from
the same run:

```sql
-- re-run in the Supabase SQL editor (or via psql) between batches
select slug from dispensaries order by slug;                                    -- → existing-slugs.txt
select license_number from dispensaries where license_number is not null;       -- → existing-licenses.txt
```

## Step 1 — Get the source data (Cannlytics `cannabis_licenses`)

Dataset: `cannlytics/cannabis_licenses` on Hugging Face (CC-BY-4.0), per-state CSVs of licensed
cannabis businesses. Columns already match the importer's `FIELD_NAMES` map: `business_dba_name`,
`license_number`, `license_type`, `license_designation`, `premise_street_address`,
`premise_city`, `premise_state`, `premise_zip_code`, `premise_latitude`/`premise_longitude`,
`business_phone`/`business_website`/`business_email`.

Download the states you want (all legal-market states, or a subset to start). If Cannlytics is
stale/missing for a given state, fall back to that state's official license portal/open-data
export and normalize its headers to the same column names before importing.

## Step 2 — Inspect license types before importing (per state)

Different states label retail licenses differently than CA. Before running the importer on a
new state's CSV, check what's actually in it:

```bash
# distinct license_type values + counts, so you can see what "retail" looks like in this state
python3 - <<'PY'
import csv, collections
with open("<state>.csv", encoding="utf-8-sig") as f:
    r = csv.DictReader(f)
    c = collections.Counter(row.get("license_type", row.get("License Type", "")).strip() for row in r)
for k, n in c.most_common():
    print(f"{n:6d}  {k}")
PY
```

## Step 3 — Import each state → migration SQL

```bash
cd packages/supabase
node scripts/import-la-dispensaries.mjs <state>.csv \
  --any-city --include-nonstorefront \
  --exclude-licenses ../../packages/supabase/scripts/seed-exports/existing-licenses.txt \
  --reserved-slugs ../../packages/supabase/scripts/seed-exports/existing-slugs.txt \
  --out supabase/migrations/$(date +%Y%m%d%H%M%S)_<state>_dispensaries.sql
```

- **Do NOT pass `--replace-unclaimed`** — that flag deletes all unclaimed dispensaries first
  (used previously for a full CA refresh). For nationwide additive loading you want incremental
  inserts only.
- ⚠️ **Retail-type filter tweak — check this per state.** The importer keeps rows whose
  `license_type` contains `retail` or `microbusiness`
  (`import-la-dispensaries.mjs`, the `isRetail`/`isMicro`/`isNonStore` block). Other states use
  different label`s ("Dispensary", "Adult-Use Retailer", "Medical Marijuana Dispensary",
  "Cannabis Retailer", etc.). Using the Step 2 output, if a state's retail licenses aren't
  matching, broaden that predicate for this run — but keep it narrow enough to exclude
  cultivators, manufacturers, distributors, and testing labs. Sanity-check the `stats.kept`
  count the script prints against what you'd expect for that state before applying the SQL.
- After each run, check the script's printed `stats` (total / notRetailer / inactive / wrongCity
  / noLocation / dupLicense / dupSlug / kept) — a `kept` count near zero or near `total` both
  indicate the filter needs adjusting.

## Step 4 — Geocode missing coordinates (required — `location` is NOT NULL)

Rows without lat/lng are dropped by the importer, so geocode before importing if a state's
export has gaps (common for delivery-only/non-storefront retailers):

```bash
python scripts/geocode-ca-licenses.py <state>.csv <state>-geo.csv
# then import <state>-geo.csv instead of the raw file in Step 3
```

Uses the free US Census batch geocoder — no API key, works for any US address.

## Step 5 — Apply the migrations to the remote DB

```bash
psql "$SB_DB_URL" -f supabase/migrations/<file>.sql
# or, if you have the Supabase CLI linked:
supabase link --project-ref ggpnghpcclngqkyelkes && supabase db push
```

## Step 6 — Enrich (same scripts as CA, now nationwide)

Always test with `--limit` first and check cost/quality before running full volume.

```bash
# phone / website / hours / google_place_id  (~$0.03–0.04 per shop)
python scripts/enrich-from-google.py enrich.sql "$SB_URL" "$SB_ANON" --limit 50
psql "$SB_DB_URL" -f enrich.sql            # review output, then re-run without --limit

# storefront photos  (~$0.017 per shop)
python scripts/gen-place-photos.py photos.sql "$SB_URL" "$SB_ANON" --limit 50
psql "$SB_DB_URL" -f photos.sql

# logos (free — Google S2 favicons, no key)
python scripts/gen-dispensary-logos.py logos.sql "$SB_URL" "$SB_ANON"
psql "$SB_DB_URL" -f logos.sql
```

## Cost & scale reality

- Nationwide is roughly 15,000–40,000 licensed dispensaries depending on how many states/license
  types you include. At ~$0.04–0.07/shop combined (Places enrich + photo), full nationwide
  enrichment is roughly **$600–$2,800**. Import, geocoding, and logos are free.
- **Do one state end-to-end first** (import → geocode → apply → enrich with `--limit`) to
  validate the Step 3 filter tweak and real per-shop cost before committing to all states.

## Verify, then hand back to the main session

```sql
select state, count(*) n,
  count(*) filter (where google_place_id is not null) enriched,
  count(*) filter (where google_photo_name is not null) with_photo
from dispensaries group by state order by n desc;
```

When done, return to the cloud session with:
- which states were loaded and their per-state counts (from the query above),
- confirmation the migrations were applied (git log of the new migration files is enough),
- any Step 3 filter tweaks you had to make per state, so they can be captured for next time.

From there the cloud session can pick up region-gating/UI, search tuning across the new states,
and a QA pass.
