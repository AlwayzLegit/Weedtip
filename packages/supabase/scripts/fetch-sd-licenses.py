#!/usr/bin/env python3
"""Fetch licensed SD medical cannabis dispensaries.

Source: the SD Dept. of Health's public establishments list
(doh.sd.gov/programs/medical-cannabis/med-cannabis-establishments/
establishments-list/) is a plain server-rendered HTML page (no JS
rendering needed, unlike the earlier-deferred assessment) with four
tables (Dispensary/Manufacturing/Cultivation/Testing Establishments,
identified by their preceding <h2>). The Dispensary Establishments table
has three columns -- Legal Name, Doing Business As, Location (city only)
-- and was fetched directly via `requests` + BeautifulSoup, no browser
needed. This data is bundled as scripts/data/sd-dispensaries-raw.csv
since the source has no license numbers or stable IDs to key off of for
a re-runnable API-style script.

No street addresses or license numbers are published, only city. Like
scripts/fetch-vt-licenses.py, this geocodes to city-centroid coordinates
via Nominatim/OpenStreetMap (free, ODbL-licensed, ~1 req/sec per its
usage policy) rather than the US Census geocoder (which requires a
street address). Multiple retailers in the same city share that city's
centroid point. license_number is synthesized (SD-DISP-0001, ...) since
none is published.

Re-run note: to refresh, re-fetch the establishments-list URL above and
re-run the table-0 (Dispensary Establishments) extraction.

Usage: python scripts/fetch-sd-licenses.py <out.csv>
"""
import csv
import os
import sys
import time

import requests

RAW_CSV = os.path.join(os.path.dirname(__file__), "data", "sd-dispensaries-raw.csv")
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def geocode_city(city, cache):
    key = city.lower().strip()
    if key in cache:
        return cache[key]
    r = requests.get(
        NOMINATIM_URL,
        params={"city": city, "state": "South Dakota", "country": "USA", "format": "json"},
        headers={"User-Agent": "WeedtipDataImport/1.0 (contact: alwayzlegit@gmail.com)"},
        timeout=15,
    )
    time.sleep(1)  # respect Nominatim's 1 req/sec usage policy
    results = r.json() if r.status_code == 200 else []
    coords = (results[0]["lat"], results[0]["lon"]) if results else (None, None)
    cache[key] = coords
    return coords


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "sd-licenses.csv"
    with open(RAW_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    cache = {}
    matched = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, row in enumerate(rows):
            lat, lon = geocode_city(row["city"], cache)
            if lat:
                matched += 1
            w.writerow({
                "business_dba_name": row["dba_name"],
                "business_legal_name": row["legal_name"],
                "license_number": f"SD-DISP-{i + 1:04d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": "",
                "premise_city": row["city"],
                "premise_state": "SD",
                "premise_zip_code": "",
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": lat or "",
                "premise_longitude": lon or "",
            })
    print(f"wrote {len(rows)} SD dispensaries to {out}; geocoded {matched} city centroids", flush=True)


if __name__ == "__main__":
    main()
