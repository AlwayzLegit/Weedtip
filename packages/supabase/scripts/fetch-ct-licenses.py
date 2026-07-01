#!/usr/bin/env python3
"""Fetch licensed CT cannabis retail locations from the state's official open-data feed.

Source: CT Dept. of Consumer Protection, "Licensed Cannabis and Medical
Marijuana Retail Locations" dataset on the state's open-data portal (Socrata),
https://internal-data.ct.gov/resource/42yd-3x3d.json — public record, no key
required. Already includes coordinates (no geocoding needed) for every row.

Usage: python scripts/fetch-ct-licenses.py <out.csv>
"""
import csv
import sys

import requests

SOCRATA = "https://internal-data.ct.gov/resource/42yd-3x3d.json"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ct-licenses.csv"
    rows, offset, page_size = [], 0, 1000
    while True:
        r = requests.get(SOCRATA, params={"$limit": page_size, "$offset": offset}, timeout=60)
        r.raise_for_status()
        batch = r.json()
        rows += batch
        offset += len(batch)
        if len(batch) < page_size:
            break
    print(f"fetched {len(rows)} CT licensed cannabis retail locations", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            loc = r.get("location") or {}
            coords = loc.get("coordinates") or [None, None]
            lng, lat = (coords + [None, None])[:2]
            w.writerow({
                "business_dba_name": r.get("dba") or r.get("business", ""),
                "business_legal_name": r.get("business", ""),
                "license_number": r.get("license", ""),
                "license_status": "Active",  # dataset is pre-filtered to licensed/active retailers
                # Every row in this dataset IS a retail location (that's its scope), but CT's own
                # sub-type labels ("Adult-Use Cannabis Only", "Medical Marijuana Only") don't contain
                # "retail" the way the importer's filter expects -- normalize so it matches, while
                # keeping CT's original label for reference.
                "license_type": f"Retail ({r.get('type', '')})",
                "license_designation": "Adult-Use" if "Adult-Use" in (r.get("type") or "") else "Medicinal",
                "premise_street_address": r.get("street", ""),
                "premise_city": r.get("city", ""),
                "premise_state": "CT",
                "premise_zip_code": r.get("zipcode", ""),
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": lat if lat is not None else "",
                "premise_longitude": lng if lng is not None else "",
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
