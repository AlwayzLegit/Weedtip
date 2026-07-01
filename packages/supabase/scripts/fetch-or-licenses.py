#!/usr/bin/env python3
"""Fetch active OR cannabis retailers from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the Oregon
Liquor and Cannabis Commission (OLCC) licensee list, dated 2023-05-02. OLCC's
own licensee data is only exposed through an interactive Tableau dashboard
(data.olcc.state.or.us), which has no scrapable CSV/API export, so this is
the best available public-record source. Already in canonical column layout
with full address + coordinates + `license_designation` ("Adult-Use") --
no geocoding needed.

Usage: python scripts/fetch-or-licenses.py <out.csv>
"""
import csv
import io
import sys

import requests

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/or/licenses-or-latest.csv"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "or-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [
        row for row in rows
        if "Retail" in (row.get("license_type") or "") and (row.get("license_status") or "").strip() == "Active"
    ]
    print(f"fetched {len(rows)} OR licenses; {len(retail)} are active retailers", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            w.writerow({k: r_.get(k, "") for k in FIELDS})
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
