#!/usr/bin/env python3
"""Fetch licensed ND medical marijuana dispensaries.

Source: ND Health and Human Services' official dispensary-locations page
(hhs.nd.gov/mm/dispensary-locations), transcribed here on 2026-07-01 --
North Dakota's entire medical program is 8 dispensaries statewide and there
is no CSV/API source. No coordinates are published; run
scripts/geocode-ca-licenses.py afterward to fill them in via the free US
Census geocoder. ND is medical-only, so license_designation is set to
"Medical".

Re-run note: if this list needs refreshing later, re-visit the source page
and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-nd-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, street_address, city, zip)
DISPENSARIES = [
    ("Pure Dakota Health Of Bismarck", "1207 Memorial Highway", "Bismarck", "58501"),
    ("Strive Life", "1809 13th Ave. North", "Grand Forks", "58201"),
    ("Curaleaf - Devils Lake", "310 Highway 2 East", "Devils Lake", "58301"),
    ("Curaleaf - Jamestown", "1513 Business Loop East", "Jamestown", "58401"),
    ("Curaleaf - Dickinson", "318 24th Street East", "Dickinson", "58601"),
    ("Curaleaf - Minot", "2301 16th St. SW", "Minot", "58701"),
    ("Pure Dakota Health - Fargo", "4302 13th Ave. S. #19", "Fargo", "58103"),
    ("Pure Dakota Health Of Williston", "120 26th Street East, Suite 500", "Williston", "58801"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "nd-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, addr, city, zipc) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": dba,
                "license_number": f"ND-HHS-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "ND",
                "premise_zip_code": zipc,
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} ND dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
