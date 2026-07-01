#!/usr/bin/env python3
"""Fetch active NM cannabis retailers from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the New Mexico
Cannabis Control Division (CCD) licensee list, dated 2023-04-30. NM's own
CCD reporting portal (crop.rld.nm.gov) has no bulk CSV/API export, and the
"Cannabis Retail Location Approval Map" ArcGIS item found during discovery
turned out to be an Albuquerque-only zoning-approval map, not a statewide
licensee feed -- so this is the best available public-record source.
Already in canonical column layout with full address + coordinates +
license_designation ("Adult-Use") -- no geocoding needed.

Usage: python scripts/fetch-nm-licenses.py <out.csv>
"""
import csv
import io
import sys

import requests

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/nm/licenses-nm-latest.csv"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "nm-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [
        row for row in rows
        if row.get("license_type") == "Cannabis Retailer" and row.get("license_status") == "Active"
    ]
    print(f"fetched {len(rows)} NM licenses; {len(retail)} are active retailers", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            row = {k: r_.get(k, "") for k in FIELDS}
            row["license_type"] = "Retail (Cannabis Retailer)"
            w.writerow(row)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
