#!/usr/bin/env python3
"""Fetch active ME adult-use cannabis retail stores from the Office of
Cannabis Policy's official monthly CSV export.

Source: maine.gov/dafs/ocp/open-data/adult-use/licensee-search links a
directly-downloadable CSV (`Adult_Use_Establishments_And_Contacts_*.csv`,
refreshed monthly) -- fetched here directly, no key or scraping needed. The
file has one row per (license, business-entity-member) pair, so multiple
rows share a LICENSE for each owner/contact; deduped here to one row per
license. `LICENSE_CATEGORY == "Store"` identifies retail storefronts. No
coordinates are published; run scripts/geocode-ca-licenses.py afterward to
fill them in via the free US Census geocoder.

Usage: python scripts/fetch-me-licenses.py <out.csv>
"""
import csv
import sys

import requests

CSV_URL = (
    "https://www.maine.gov/dafs/ocp/sites/maine.gov.dafs.ocp/files/inline-files/"
    "Adult_Use_Establishments_And_Contacts_2026_05_01.csv"
)
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "me-licenses.csv"
    r = requests.get(CSV_URL, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    rows = list(csv.DictReader(r.text.splitlines()))
    stores = [row for row in rows if row.get("LICENSE_CATEGORY") == "Store" and row.get("LICENSE_STATUS") == "Active"]

    seen = {}
    for row in stores:
        seen.setdefault(row["LICENSE"], row)
    print(f"fetched {len(rows)} ME license-contact rows; {len(seen)} unique active stores", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in seen.values():
            w.writerow({
                "business_dba_name": row.get("DBA") or row.get("LICENSE_NAME", ""),
                "business_legal_name": row.get("LICENSE_NAME", ""),
                "license_number": row.get("LICENSE", ""),
                "license_status": "Active",
                "license_type": "Retail (Store)",
                "license_designation": "",
                "premise_street_address": row.get("LICENSE_ADDRESS", ""),
                "premise_city": row.get("LICENSE_CITY", ""),
                "premise_state": "ME",
                "premise_zip_code": "",
                "business_phone": row.get("PRIMARY_CONTACT_NUMBER", ""),
                "business_website": row.get("LICENSE_WEBSITE", ""),
                "business_email": row.get("PRIMARY_CONTACT_EMAIL", ""),
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
