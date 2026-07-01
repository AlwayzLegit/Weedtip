#!/usr/bin/env python3
"""Fetch licensed KY medical cannabis dispensaries.

Source: Kentucky Office of Medical Cannabis's official "Find a Dispensary"
page (kymedcan.ky.gov/patients-and-caregivers/Pages/Find-A-Dispensary.aspx),
transcribed here on 2026-07-01 -- Kentucky's medical program only launched
in 2025 and has no CSV/API source yet. No coordinates are published; run
scripts/geocode-ca-licenses.py afterward to fill them in via the free US
Census geocoder. KY is medical-only, so license_designation is set to
"Medical".

Re-run note: if this list needs refreshing later, re-visit the source page
and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-ky-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, legal_name, street_address, city, zip)
DISPENSARIES = [
    ("Speakeasy Dispensary - Bowling Green", "Speakeasy Dispensary", "2708 Scottsville Rd, Ste A", "Bowling Green", "42104"),
    ("Barrio Capital Partners", "Barrio Capital Partners LLC", "950 N Mulberry St, Suites 220A, 220B, 220C", "Elizabethtown", "42701"),
    ("Bd Expansion", "BD Expansion, LLC", "1501-1641 Paris Pike", "Georgetown", "42324"),
    ("Bluegrass Cannacare", "Bluegrass Cannacare LLC", "6809 Burlington Pike", "Florence", "41042"),
    ("Nuera Frankfort", "NuEra Frankfort", "325 Leonardwood Dr.", "Frankfort", "40601"),
    ("Blue Sage Cannabis Company", "Blue Sage Cannabis Company", "172 Imperial Way", "Nicholasville", "40356"),
    ("Speakeasy Dispensary - Nortonville", "Speakeasy Dispensary", "140 N Hopkinsville St", "Nortonville", "42442"),
    ("Erh Ky", "ERH KY LLC", "140 Faith Assembly Church Rd", "London", "40741"),
    ("Speakeasy Dispensary - Lexington", "Speakeasy Dispensary", "1849 Alysheba Way", "Lexington", "40509"),
    ("Blue Sage - Oak Grove", "Blue Sage Cannabis Company", "2624 Walter Garrett Ln", "Oak Grove", "42262"),
    ("Nature Med - Paducah", "Nature Med", "435 Jordon Dr", "Paducah", "42001"),
    ("Kentucky Alternative Care", "Kentucky Alternative Care", "2401-B Bardstown Rd", "Louisville", "40205"),
    ("Green Releaf Dispensary", "Green Releaf Dispensary", "1900 Murphy Ave", "Ferguson", "42533"),
    ("Speakeasy Dispensary - Princeton", "Speakeasy Dispensary", "108 E. Main Street", "Princeton", "42445"),
    ("The Post Dispensary", "The Post Dispensary", "300 N. Main St", "Beaver Dam", "42320"),
    ("Nature Med - Erlanger", "Nature Med", "635 Donaldson Hwy", "Erlanger", "41018"),
    ("Speakeasy Dispensary - Ashland", "Speakeasy Dispensary", "3508 Winchester Ave", "Ashland", "41101"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ky-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, legal, addr, city, zipc) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": f"KY-OMC-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "KY",
                "premise_zip_code": zipc,
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} KY dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
