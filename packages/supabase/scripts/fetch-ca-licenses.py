#!/usr/bin/env python3
"""Fetch the current California DCC cannabis license dataset.

Pulls the live "Cannabis Unified License Search" data (https://search.cannabis.ca.gov/)
straight from the DCC's public API and writes a snake_case CSV that
`import-la-dispensaries.mjs` reads unchanged. The API host is discovered from
the site's /config.js so this keeps working if DCC redeploys the backend.

Public-record government data only — no Weedmaps/Leafly scraping.

Usage:
    python scripts/fetch-ca-licenses.py            # -> licenses-ca-live.csv
    python scripts/fetch-ca-licenses.py out.csv    # custom output path

Then (from packages/supabase), optionally geocode missing coords:
    python scripts/geocode-ca-licenses.py licenses-ca-live.csv licenses-ca-live-geo.csv
And import (full refresh, replacing the prior unclaimed seed):
    node scripts/import-la-dispensaries.mjs ../../licenses-ca-live-geo.csv \\
      --any-city --include-nonstorefront --replace-unclaimed \\
      --reserved-slugs demo-slugs.txt --out supabase/migrations/<ts>_refresh_ca_dispensaries.sql
"""
import csv
import re
import sys
import time

import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36"
HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Origin": "https://search.cannabis.ca.gov",
    "Referer": "https://search.cannabis.ca.gov/",
}


def camel_to_snake(s: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()


# Last-known API host, used if config.js can't be parsed (transient/redeploy).
FALLBACK_API_BASE = "https://as-dcc-pub-cann-w-p-002.azurewebsites.net"


def discover_api_base() -> str:
    """Read the API base from the search site's config.js (survives redeploys),
    with retries and a known-host fallback so the unattended job stays robust."""
    import time
    for attempt in range(3):
        try:
            cfg = requests.get("https://search.cannabis.ca.gov/config.js", headers=HEADERS, timeout=60).text
            m = re.search(r"CANNA_API:\s*['\"]([^'\"]+)['\"]", cfg)
            if m:
                return m.group(1).rstrip("/")
        except Exception:
            pass
        time.sleep(3)
    print("config.js discovery failed; using fallback API host", flush=True)
    return FALLBACK_API_BASE


def fetch_all(base: str):
    rows, page = [], 1
    while True:
        for attempt in range(4):
            try:
                r = requests.get(
                    base + "/licenses/filteredSearch",
                    headers=HEADERS,
                    params={"pageSize": 1000, "pageNumber": page, "searchQuery": ""},
                    timeout=120,
                )
                body = r.json()
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2)
        rows.extend(body["data"])
        md = body["metadata"]
        if page == 1:
            print(f"totalCount {md['totalCount']} totalPages {md['totalPages']}", flush=True)
        if not md["hasNext"]:
            break
        page += 1
        time.sleep(0.1)
    return rows


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "licenses-ca-live.csv"
    base = discover_api_base()
    print("API base:", base, flush=True)
    rows = fetch_all(base)
    print("fetched", len(rows), "records", flush=True)
    cols = [camel_to_snake(k) for k in rows[0].keys()]
    if "business_website" not in cols:
        cols.append("business_website")
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for d in rows:
            sd = {camel_to_snake(k): ("" if v is None else v) for k, v in d.items()}
            w.writerow([sd.get(c, "") for c in cols])
    print("wrote", out, flush=True)


if __name__ == "__main__":
    main()
