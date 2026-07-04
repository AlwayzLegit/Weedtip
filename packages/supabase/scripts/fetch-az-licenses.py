#!/usr/bin/env python3
"""Fetch operating AZ cannabis retailers from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the Arizona
Department of Health Services (ADHS) marijuana establishment licensee list,
dated 2023-08-13. ADHS's own site only offers a license-verification lookup
tool (no bulk CSV/API), so this is the best available public-record source.

AZ's `license_type` covers establishments, offsite cultivation, and labs
together -- retailers are identified by `license_designation` containing
"Retail" (e.g. "Retail - Sell") combined with `license_type ==
"Marijuana Establishment"` and `license_status == "Operating"`. The
`business_email` field has an embedded-newline artifact ("Email\\n<addr>")
from the upstream scrape -- stripped here. Coordinates are already present
(no geocoding needed).

Usage: python scripts/fetch-az-licenses.py <out.csv>
"""
import csv
import io
import re
import sys

import requests

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/az/licenses-az-latest.csv"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def clean_ws(v):
    return re.sub(r"\s+", " ", (v or "")).strip()


def clean_email(v):
    return clean_ws(v).removeprefix("Email").strip()


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "az-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [
        row for row in rows
        if row.get("license_type") == "Marijuana Establishment"
        and row.get("license_status") == "Operating"
        and "Retail" in (row.get("license_designation") or "")
    ]
    print(f"fetched {len(rows)} AZ licenses; {len(retail)} are operating retailers", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            row = {k: r_.get(k, "") for k in FIELDS}
            row["business_dba_name"] = clean_ws(row["business_dba_name"])
            row["business_legal_name"] = clean_ws(row["business_legal_name"])
            row["premise_street_address"] = clean_ws(row["premise_street_address"])
            row["business_email"] = clean_email(row["business_email"])
            row["license_type"] = "Retail (Marijuana Establishment)"
            row["license_status"] = "Active"
            # AZ's designation ("Retail - Sell") describes sale permission, not
            # medical/adult-use scope -- nearly all AZ dispensaries are
            # dual-licensed, so leave blank to let the importer default both
            # is_medical/is_recreational to true rather than false-matching
            # on a designation string that isn't about that axis.
            row["license_designation"] = ""
            w.writerow(row)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
