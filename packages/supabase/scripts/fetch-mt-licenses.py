#!/usr/bin/env python3
"""Fetch active MT cannabis retailers from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the Montana
Cannabis Control Division licensee list, dated 2023-08-13. MT's own site
only publishes an HTML table (name/city/phone, no street address) and a
separate PDF list whose URL has since moved/broken, so this is the best
available public-record source with usable addresses. All 422 rows are
`license_type == "Commercial - Retailer"` and `license_status == "Active"`.
A handful of rows are missing coordinates -- run
scripts/geocode-ca-licenses.py afterward to fill those in via the free US
Census geocoder.

Usage: python scripts/fetch-mt-licenses.py <out.csv>
"""
import csv
import io
import sys

import requests

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/mt/licenses-mt-latest.csv"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "mt-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [row for row in rows if row.get("license_status") == "Active"]
    print(f"fetched {len(rows)} MT licenses; {len(retail)} are active retailers", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            row = {k: r_.get(k, "") for k in FIELDS}
            row["license_type"] = "Retail (Commercial Retailer)"
            w.writerow(row)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
