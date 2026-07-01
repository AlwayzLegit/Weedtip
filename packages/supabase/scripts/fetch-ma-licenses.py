#!/usr/bin/env python3
"""Fetch operating MA cannabis retailers from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the MA Cannabis
Control Commission licensee list. MA CCC does not publish a Socrata/API open-
data feed for this (masscannabiscontrol.com/open-data has no machine-readable
files), so this is the best available public-record source.

The raw license_status field ("COMPLETE"/"PAYMENT_PENDING") doesn't indicate
whether a shop is actually open; approved_license_stages does --
"COMMENCE OPS" means the retailer has begun operations. That's used as the
active filter here (more conservative than including "FINAL LICENSE"/
"PROVISIONAL LICENSE", which may not yet be open to the public). The premise
street address lives in establishment_address, not premise_street_address.

Usage: python scripts/fetch-ma-licenses.py <out.csv>
"""
import csv
import io
import sys

import requests

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/ma/licenses-ma-latest.csv"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ma-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [
        row for row in rows
        if "retail" in (row.get("license_type") or "").lower()
        and (row.get("approved_license_stages") or "").strip() == "COMMENCE OPS"
    ]
    print(f"fetched {len(rows)} MA licenses; {len(retail)} are operating retailers", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            w.writerow({
                "business_dba_name": r_.get("business_dba_name") or r_.get("business_legal_name", ""),
                "business_legal_name": r_.get("business_legal_name", ""),
                "license_number": r_.get("license_number", ""),
                "license_status": "Active",
                "license_type": "Retail (Marijuana Retailer)",
                "license_designation": "",
                "premise_street_address": r_.get("establishment_address") or r_.get("business_address_1", ""),
                "premise_city": r_.get("premise_city") or r_.get("town", ""),
                "premise_state": "MA",
                "premise_zip_code": r_.get("premise_zip_code", "").split(".")[0],
                "business_phone": r_.get("business_phone", ""),
                "business_website": r_.get("business_website", ""),
                "business_email": r_.get("business_email", ""),
                "premise_latitude": r_.get("premise_latitude", ""),
                "premise_longitude": r_.get("premise_longitude", ""),
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
