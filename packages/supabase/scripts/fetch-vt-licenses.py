#!/usr/bin/env python3
"""Fetch licensed VT cannabis retailers.

Source: the Cannabis Control Board's official licenses page
(ccb.vermont.gov/licenses) embeds an interactive Power BI report
(app.powerbigov.us) whose underlying table has no public REST API; the
data was extracted by rendering the report in a real browser (Chrome, via
the claude-in-chrome MCP), filtering to License Type = Retailer, and
reading the resulting grid from the accessibility tree in overlapping
scroll passes -- 110 of 110 active retailer licenses (matching the
report's own "Total License Count" exactly), each with license number,
business name, and city. This data is bundled as
scripts/data/vt-dispensaries-raw.csv since it's a one-time browser
extraction, not a re-runnable API call.

No street addresses are published in this table (city only), so this
script geocodes to city-centroid coordinates via Nominatim/OpenStreetMap
(free, ODbL-licensed, ~1 req/sec per its usage policy) rather than the US
Census geocoder used elsewhere (which requires a street address). Multiple
retailers in the same city will share that city's centroid point --
lower precision than street-level, but still correctly places each
business in its town. VT permits both medical and adult-use sales at the
same storefronts, so license_designation is left blank (importer defaults
both flags true).

Re-run note: to refresh, re-open the Power BI report URL above in a
browser (Type filter = Retailer) and re-extract the grid.

Usage: python scripts/fetch-vt-licenses.py <out.csv>
"""
import csv
import os
import sys
import time

import requests

RAW_CSV = os.path.join(os.path.dirname(__file__), "data", "vt-dispensaries-raw.csv")
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
        params={"city": city, "state": "Vermont", "country": "USA", "format": "json"},
        headers={"User-Agent": "WeedtipDataImport/1.0 (contact: alwayzlegit@gmail.com)"},
        timeout=15,
    )
    time.sleep(1)  # respect Nominatim's 1 req/sec usage policy
    results = r.json() if r.status_code == 200 else []
    coords = (results[0]["lat"], results[0]["lon"]) if results else (None, None)
    cache[key] = coords
    return coords


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "vt-licenses.csv"
    with open(RAW_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    cache = {}
    matched = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in rows:
            lat, lon = geocode_city(row["city"], cache)
            if lat:
                matched += 1
            w.writerow({
                "business_dba_name": row["name"],
                "business_legal_name": row["name"],
                "license_number": row["license"],
                "license_status": "Active",
                "license_type": "Retail (Retailer)",
                "license_designation": "",
                "premise_street_address": "",
                "premise_city": row["city"],
                "premise_state": "VT",
                "premise_zip_code": "",
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": lat or "",
                "premise_longitude": lon or "",
            })
    print(f"wrote {len(rows)} VT dispensaries to {out}; geocoded {matched} city centroids", flush=True)


if __name__ == "__main__":
    main()
