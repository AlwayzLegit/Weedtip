#!/usr/bin/env bash
# ── Monthly California data refresh ──────────────────────────────────────────
# Re-pulls the live DCC registry + OpenStreetMap and syncs the dispensaries
# table to current, idempotently. Run by .github/workflows/refresh-ca-data.yml
# (or manually). Public-record + open data only — no Google/Yelp scraping.
#
# Required env (CI secrets):
#   SUPABASE_DB_URL    Postgres connection string (e.g. postgresql://...@db.<ref>.supabase.co:5432/postgres)
#   SUPABASE_URL       https://<ref>.supabase.co
#   SUPABASE_ANON_KEY  publishable/anon key (used for read-only slug/license lookups)
#
# Tools: bash, python3 (requests, pandas), node, psql.
set -euo pipefail

: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL}"
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY}"

cd "$(dirname "$0")/.."   # -> packages/supabase
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PSQL=(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q)

echo "1/7 Fetch DCC registry"
python3 scripts/fetch-ca-licenses.py "$TMP/licenses.csv"

echo "2/7 Geocode missing coordinates"
python3 scripts/geocode-ca-licenses.py "$TMP/licenses.csv" "$TMP/licenses-geo.csv"

echo "3/7 Generate + apply storefront/microbusiness refresh (replace prior unclaimed seed)"
printf '%s\n' bay-state-wellness desert-bloom-phoenix emerald-collective green-leaf-nyc \
  mile-high-denver rose-city-cannabis silver-state-vegas sunset-la > "$TMP/demo-slugs.txt"
node scripts/import-la-dispensaries.mjs "$TMP/licenses-geo.csv" \
  --any-city --include-nonstorefront --replace-unclaimed \
  --reserved-slugs "$TMP/demo-slugs.txt" --out "$TMP/refresh.sql"
"${PSQL[@]}" -f "$TMP/refresh.sql"

echo "4/7 Generate + apply delivery-only (location-less) listings"
python3 scripts/gen-delivery-only.py "$TMP/delivery.sql" "$SUPABASE_URL" "$SUPABASE_ANON_KEY"
"${PSQL[@]}" -f "$TMP/delivery.sql"

echo "5/7 Relabel DCC contacts -> dcc_* and clear public phone/email (pre-enrichment)"
"${PSQL[@]}" <<'SQL'
update public.dispensaries set dcc_phone = phone, dcc_email = email
  where owner_id is null and phone is not null;
update public.dispensaries set phone = null, email = null
  where owner_id is null;
SQL

echo "6/7 Backfill legal_name from DCC"
python3 scripts/gen-legal-names.py "$TMP/legal.sql" "$SUPABASE_URL" "$SUPABASE_ANON_KEY"
"${PSQL[@]}" -f "$TMP/legal.sql"

echo "7/7 Enrich public phone/website from OpenStreetMap"
python3 scripts/enrich-from-osm.py "$TMP/osm.sql" "$SUPABASE_URL" "$SUPABASE_ANON_KEY"
"${PSQL[@]}" -f "$TMP/osm.sql"

echo "Refresh complete."
