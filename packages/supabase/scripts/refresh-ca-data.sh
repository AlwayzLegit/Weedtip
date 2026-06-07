#!/usr/bin/env bash
# ── Monthly California data refresh ──────────────────────────────────────────
# Re-pulls the live DCC registry + OpenStreetMap and syncs the dispensaries
# table to current, idempotently. Run by .github/workflows/refresh-ca-data.yml
# (or manually). Public-record + open data only — no Google/Yelp scraping.
#
#   --dry-run   Generate all SQL and print row-count diffs vs the current DB,
#               but DON'T apply anything. (Also honored via DRY_RUN=1.)
#
# Required env (CI secrets):
#   SUPABASE_DB_URL    Postgres connection string (apply + read counts). Optional with --dry-run.
#   SUPABASE_URL       https://<ref>.supabase.co
#   SUPABASE_ANON_KEY  publishable/anon key (read-only slug/license lookups)
#
# Tools: bash, python3 (requests, pandas), node, psql.
set -euo pipefail

DRY_RUN="${DRY_RUN:-}"
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY}"
if [[ -z "$DRY_RUN" ]]; then : "${SUPABASE_DB_URL:?set SUPABASE_DB_URL}"; fi

cd "$(dirname "$0")/.."   # -> packages/supabase
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# rows() — count INSERT value rows / UPDATE statements in a generated .sql file.
rows() { grep -cE "^  \('|^update " "$1" 2>/dev/null || echo 0; }

# apply FILE LABEL — psql-apply (one txn), or in dry-run just report the count.
apply() {
  local file="$1" label="$2"
  if [[ -n "$DRY_RUN" ]]; then
    printf '   [dry-run] %-24s %6s rows (not applied)\n' "$label" "$(rows "$file")"
  else
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f "$file"
  fi
}

# current SQL — read a scalar from the DB for the dry-run diff ("?" if unavailable).
current() { [[ -n "${SUPABASE_DB_URL:-}" ]] && psql "$SUPABASE_DB_URL" -At -c "$1" 2>/dev/null || echo "?"; }

echo "1 Fetch DCC registry"
python3 scripts/fetch-ca-licenses.py "$TMP/licenses.csv"

echo "2 Geocode missing coordinates"
python3 scripts/geocode-ca-licenses.py "$TMP/licenses.csv" "$TMP/licenses-geo.csv"

echo "3 Generate storefront/microbusiness refresh"
printf '%s\n' bay-state-wellness desert-bloom-phoenix emerald-collective green-leaf-nyc \
  mile-high-denver rose-city-cannabis silver-state-vegas sunset-la > "$TMP/demo-slugs.txt"
node scripts/import-la-dispensaries.mjs "$TMP/licenses-geo.csv" \
  --any-city --include-nonstorefront --replace-unclaimed \
  --reserved-slugs "$TMP/demo-slugs.txt" --out "$TMP/refresh.sql"
apply "$TMP/refresh.sql" "refresh (storefront/micro)"

echo "4 Generate delivery-only (location-less) listings"
python3 scripts/gen-delivery-only.py "$TMP/delivery.sql" "$SUPABASE_URL" "$SUPABASE_ANON_KEY"
apply "$TMP/delivery.sql" "delivery-only"

echo "5 Relabel DCC contacts -> dcc_* and clear public phone/email"
if [[ -n "$DRY_RUN" ]]; then
  echo "   [dry-run] relabel (move phone/email -> dcc_*, null public) — not applied"
else
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
update public.dispensaries set dcc_phone = phone, dcc_email = email
  where owner_id is null and phone is not null;
update public.dispensaries set phone = null, email = null
  where owner_id is null;
SQL
fi

echo "6 Backfill legal_name from DCC"
python3 scripts/gen-legal-names.py "$TMP/legal.sql" "$SUPABASE_URL" "$SUPABASE_ANON_KEY"
apply "$TMP/legal.sql" "legal_name backfill"

echo "7 Enrich public phone/website from OpenStreetMap"
python3 scripts/enrich-from-osm.py "$TMP/osm.sql" "$SUPABASE_URL" "$SUPABASE_ANON_KEY"
apply "$TMP/osm.sql" "OSM enrichment"

if [[ -n "$DRY_RUN" ]]; then
  echo
  echo "── Dry-run summary (generated vs current DB) ──"
  printf '   storefront/micro refresh : %6s generated\n' "$(rows "$TMP/refresh.sql")"
  printf '   delivery-only            : %6s generated   (current: %s)\n' \
    "$(rows "$TMP/delivery.sql")" \
    "$(current "select count(*) from public.dispensaries where is_delivery and location is null")"
  printf '   legal_name backfill      : %6s generated\n' "$(rows "$TMP/legal.sql")"
  printf '   OSM enrichment           : %6s generated\n' "$(rows "$TMP/osm.sql")"
  printf '   current total / owner-null : %s / %s\n' \
    "$(current "select count(*) from public.dispensaries")" \
    "$(current "select count(*) from public.dispensaries where owner_id is null")"
  echo "   (nothing applied)"
else
  echo "Refresh complete."
fi
