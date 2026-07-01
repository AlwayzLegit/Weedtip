#!/usr/bin/env python3
"""Fetch licensed IA medical cannabis dispensaries.

Source: HHS Iowa's official dispensary-locations page
(hhs.iowa.gov/health-prevention/medical-cannabis/medical-cannabis
-dispensary-locations) plus the two licensed operators' own sites
(Bud & Mary's / MedPharm Iowa, Iowa Cannabis Company), transcribed here on
2026-07-01 -- Iowa's entire medical program is capped at 2 operators
running 5 total dispensaries statewide, and no CSV/API source exists. No
coordinates are published; run scripts/geocode-ca-licenses.py afterward.
IA is medical-only, so license_designation is set to "Medical".

Re-run note: if this list needs refreshing later, re-visit the source pages
and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-ia-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, legal_name, street_address, city, zip)
DISPENSARIES = [
    ("Bud & Mary's - Sioux City", "MedPharm Iowa", "5700 Sunnybrook Drive", "Sioux City", "51106"),
    ("Bud & Mary's - Windsor Heights", "MedPharm Iowa", "7239 Apple Valley Drive", "Windsor Heights", "50324"),
    ("Iowa Cannabis Company - Waterloo", "Iowa Cannabis Company", "1955 Laporte Rd", "Waterloo", "50702"),
    ("Iowa Cannabis Company - Iowa City", "Iowa Cannabis Company", "322 Hwy 1 W", "Iowa City", "52246"),
    ("Iowa Cannabis Company - Council Bluffs", "Iowa Cannabis Company", "3615 9th Ave", "Council Bluffs", "51501"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ia-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, legal, addr, city, zipc) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": f"IA-HHS-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "IA",
                "premise_zip_code": zipc,
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} IA dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
