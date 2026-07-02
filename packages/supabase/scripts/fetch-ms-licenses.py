#!/usr/bin/env python3
"""Fetch licensed MS medical cannabis dispensaries.

Source: the Mississippi Medical Cannabis Program's public business search
(mmcp.ms.gov/search_business) is a Drupal site whose "search_business"
module server-renders the FULL result set (372 records across all
business types -- Dispensary, Cultivator, Processor, Transporter,
Testing, Disposal, Research) as a JSON blob embedded directly in the
page's <script type="application/json"> drupalSettings tag
(data.search_business.jsonData, itself a JSON string requiring a second
json.loads). No JS rendering, pagination, or browser is needed -- a
plain `requests.get()` on the page URL returns everything (previously
deferred as a "JS-hidden search tool", which turned out not to be
JS-hidden at all once the embedded settings blob was found). Filtered to
businessType == "Dispensary": 196 records, each with a combined
"{street} {city}, MS {zip}" physicalAddress string (no reliable
street/city delimiter -- e.g. "1536 W PEACE ST CANTON, MS 39046"). This
data is bundled as scripts/data/ms-dispensaries-raw.csv since re-running
requires re-parsing the embedded JSON, not a stable query-param API.

Because physicalAddress can't be split into street/city cleanly, this
geocodes via the US Census ONE-LINE geocoder (onelineaddress endpoint,
free, no key) instead of the batch geocoder used elsewhere -- it accepts
a single combined address string and returns both coordinates AND
parsed address components (including city), solving geocoding and city
extraction in one request per row. Slower than batch (one HTTP call per
row) but there's no other way to get a clean city out of this format.

Re-run note: to refresh, re-fetch the search_business page URL above,
re-extract the embedded JSON (see this script's git history for the
extraction snippet), and re-run.

Usage: python scripts/fetch-ms-licenses.py <out.csv>
"""
import csv
import os
import sys
import time

import requests

RAW_CSV = os.path.join(os.path.dirname(__file__), "data", "ms-dispensaries-raw.csv")
CENSUS_ONELINE_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def geocode_oneline(address):
    r = requests.get(
        CENSUS_ONELINE_URL,
        params={"address": address, "benchmark": "Public_AR_Current", "format": "json"},
        timeout=15,
    )
    time.sleep(0.3)
    if r.status_code != 200:
        return None, None, ""
    matches = r.json().get("result", {}).get("addressMatches", [])
    if not matches:
        return None, None, ""
    m = matches[0]
    coords = m["coordinates"]
    city = m["addressComponents"].get("city", "")
    return coords["y"], coords["x"], city


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ms-licenses.csv"
    with open(RAW_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    matched = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in rows:
            lat, lon, city = geocode_oneline(row["physical_address"])
            if lat:
                matched += 1
            w.writerow({
                "business_dba_name": row["business_name"],
                "business_legal_name": row["legal_entity_name"] or row["business_name"],
                "license_number": row["license_number"],
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": "",
                "premise_city": city,
                "premise_state": "MS",
                "premise_zip_code": "",
                "business_phone": row["phone"],
                "business_website": "",
                "business_email": row["email"],
                "premise_latitude": lat or "",
                "premise_longitude": lon or "",
            })
    print(f"wrote {len(rows)} MS dispensaries to {out}; geocoded {matched} via Census one-line", flush=True)


if __name__ == "__main__":
    main()
