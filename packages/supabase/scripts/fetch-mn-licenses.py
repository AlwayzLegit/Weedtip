#!/usr/bin/env python3
"""Fetch licensed MN cannabis dispensaries via MN Cannabis Hub's public API.

Source: the Minnesota Office of Cannabis Management's own site (mn.gov/ocm)
is uniformly blocked by a Radware bot-manager challenge on every path
(confirmed on multiple pages), so its downloadable license-holder data
isn't reachable programmatically. MN Cannabis Hub (mncannabishub.com) --
a directory site that states it verifies listings against the OCM registry
-- exposes the paginated data backing its own dispensary directory at a
plain JSON endpoint (`/api/dispensaries?page=N`, found by inspecting the
page's own Next.js JS bundle for its `fetch()` call), which is used here
directly. 213 dispensaries across 9 pages of 24 each, full address +
phone + website + recreational/medical flags.

Usage: python scripts/fetch-mn-licenses.py <out.csv>
"""
import csv
import sys
import time

import requests

API_URL = "https://mncannabishub.com/api/dispensaries"


def get_with_retry(params, tries=4):
    for attempt in range(tries):
        try:
            r = requests.get(API_URL, params=params, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            if attempt == tries - 1:
                raise
            time.sleep(3)
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "mn-licenses.csv"
    first = get_with_retry({"page": 1})
    total_pages = first["totalPages"]
    rows = list(first["dispensaries"])
    for page in range(2, total_pages + 1):
        rows.extend(get_with_retry({"page": page})["dispensaries"])
    print(f"fetched {len(rows)} MN dispensaries across {total_pages} pages", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in rows:
            # importer matches /adult/ and /medic/ against this string
            designation = "Adult-Use" if row.get("servesRecreational") else ""
            if row.get("servesMedical"):
                designation = (designation + " Medical").strip()
            w.writerow({
                "business_dba_name": row.get("name", ""),
                "business_legal_name": row.get("name", ""),
                "license_number": row.get("id", ""),
                "license_status": "Active",
                "license_type": f"Retail ({row.get('licenseType', 'Dispensary')})",
                "license_designation": designation,
                "premise_street_address": row.get("address", ""),
                "premise_city": row.get("city", ""),
                "premise_state": "MN",
                "premise_zip_code": row.get("zipCode", ""),
                "business_phone": row.get("phone", "") or "",
                "business_website": row.get("website", "") or "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
