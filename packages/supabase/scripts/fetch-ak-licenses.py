#!/usr/bin/env python3
"""Fetch active AK cannabis retail stores from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the Alaska
Alcohol and Marijuana Control Office (AMCO) licensee list, dated 2023-08-12.
AMCO's own license-search tool has no bulk CSV/API export, so this is the
best available public-record source. Filters `license_type ==
"Retail Marijuana Store"` and `license_status == "Active-Operating"`. A
handful of rows are missing coordinates and/or have a suite number leaked
into the city/zip fields (an upstream data-quality artifact) -- run
scripts/geocode-ca-licenses.py afterward to fill in missing coordinates via
the free US Census geocoder.

Usage: python scripts/fetch-ak-licenses.py <out.csv>
"""
import csv
import io
import sys

import requests

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/ak/licenses-ak-latest.csv"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ak-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [
        row for row in rows
        if row.get("license_type") == "Retail Marijuana Store" and row.get("license_status") == "Active-Operating"
    ]
    print(f"fetched {len(rows)} AK licenses; {len(retail)} are active retail stores", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            row = {k: r_.get(k, "") for k in FIELDS}
            row["license_type"] = "Retail (Retail Marijuana Store)"
            w.writerow(row)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
