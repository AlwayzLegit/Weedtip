#!/usr/bin/env python3
"""Fetch open AL medical cannabis dispensaries.

Source: Alabama's medical cannabis retail market only opened its first
storefront on 2026-06-04 (Callie's Apothecary, Montgomery) after years of
regulatory delay; the other 3 licensed operators (CCS of Alabama, GP6
Wellness, RJK Holdings -- each allowed up to 3 sites) are still opening
locations through summer 2026 with no confirmed addresses published yet.
This transcribes only the one confirmed-open location as of 2026-07-01,
per Alabama Reflector / MJBizDaily reporting -- not padding with
speculative not-yet-open sites. No coordinates published; run
scripts/geocode-ca-licenses.py afterward. AL is medical-only, so
license_designation is set to "Medical".

Re-run note: revisit AMCC's cannabis-businesses page later this year as
more dispensaries open and add them to DISPENSARIES below.

Usage: python scripts/fetch-al-licenses.py <out.csv>
"""
import csv
import sys

DISPENSARIES = [
    ("Callie's Apothecary", "Callie's Apothecary", "5232 Atlanta Highway", "Montgomery", "36109"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "al-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, legal, addr, city, zipc) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": f"AL-AMCC-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "AL",
                "premise_zip_code": zipc,
                "business_phone": "",
                "business_website": "https://shoppecalliesal.com/",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} AL dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
