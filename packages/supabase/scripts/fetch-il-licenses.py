#!/usr/bin/env python3
"""Fetch licensed IL cannabis retailers from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the IL Dept. of
Financial and Professional Regulation (IDFPR) licensee list, dated 2023-07-28.
IDFPR's own site doesn't publish a machine-readable dispensary list (its
adult-use cannabis page returns a 404 for the expected URL), so this is the
best available public-record source. NOTE: only 138 retailers are present here
vs. ~200+ actually licensed as of more recent years -- treat as a base layer to
be supplemented if a fresher source is found later.

Already in canonical column layout with full address + coordinates + phone.

Usage: python scripts/fetch-il-licenses.py <out.csv>
"""
import csv
import io
import re
import sys

import requests


def clean_ws(v):
    """Collapse embedded newlines/whitespace (a PDF-scraping artifact in the
    upstream business name fields, e.g. "Mapleglen Care\\nCenter")."""
    return re.sub(r"\s+", " ", (v or "")).strip()

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/il/licenses-il-latest.csv"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "il-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [row for row in rows if "Retailer" in (row.get("license_type") or "")]
    print(f"fetched {len(rows)} IL licenses; {len(retail)} are retailers", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            row = {k: r_.get(k, "") for k in FIELDS}
            row["business_dba_name"] = clean_ws(row["business_dba_name"])
            row["business_legal_name"] = clean_ws(row["business_legal_name"])
            row["premise_street_address"] = clean_ws(row["premise_street_address"])
            row["premise_state"] = "IL"
            w.writerow(row)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
