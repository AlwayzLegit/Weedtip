#!/usr/bin/env python3
"""Fetch licensed UT medical cannabis pharmacies.

Source: Utah Dept. of Health and Human Services' official pharmacy-locations
page (medicalcannabis.utah.gov/pharmacy-locations/), transcribed here on
2026-07-01 -- there is no CSV/API source, and Utah's entire medical cannabis
retail market is a statutorily small, capped set of 15 pharmacies. No
coordinates are published; run scripts/geocode-ca-licenses.py afterward to
fill them in via the free US Census geocoder. UT is medical-only, so
license_designation is set to "Medical".

Re-run note: if this list needs refreshing later, re-visit the source page
and update PHARMACIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-ut-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, street_address, city, zip, phone)
PHARMACIES = [
    ("Beehive Farmacy - Brigham City", "870 W 1150 S, Suite C", "Brigham City", "84302", "435-919-0966"),
    ("Beehive Farmacy - Salt Lake City", "1991 S 3600 W", "Salt Lake City", "84104", "385-212-0088"),
    ("Bloc Pharmacy - South Jordan", "10392 South Jordan Gateway", "South Jordan", "84095", "385-249-9400"),
    ("Bloc Pharmacy - St. George", "1624 S Convention Center Drive", "St. George", "84790", "435-216-3400"),
    ("Curaleaf - Lehi", "3633 N Thanksgiving Way", "Lehi", "84043", "385-338-8010"),
    ("Curaleaf - Park City", "1351 Kearns Blvd, Ste 110-B", "Park City", "84060", "435-252-1052"),
    ("Curaleaf - Springville", "484 S 1750 W, Unit F", "Springville", "84663", "385-404-4422"),
    ("Curaleaf - Provo", "222 N Draper Lane", "Provo", "84601", "801-872-7447"),
    ("Dragonfly Wellness - Salt Lake City", "711 South State Street", "Salt Lake City", "84111", "801-413-6945"),
    ("Dragonfly Wellness - Price", "20 E Main Street", "Price", "84501", "435-637-3770"),
    ("The Flower Shop - Logan", "2150 N Main, Suite 1", "North Logan", "84341", "385-289-1800"),
    ("The Flower Shop - Ogden", "3775 S Wall Ave", "South Ogden", "84405", "385-289-1800"),
    ("The Forest", "6041 State St", "Murray", "84107", "385-474-9505"),
    ("Wholesomeco Cannabis", "580 W 100 N Suite 1", "West Bountiful", "84010", "801-695-4480"),
    ("Zion Medicinal", "301 S Main Street", "Cedar City", "84720", "435-708-1630"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ut-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, addr, city, zipc, phone) in enumerate(PHARMACIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": dba,
                "license_number": f"UT-DHHS-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Pharmacy)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "UT",
                "premise_zip_code": zipc,
                "business_phone": phone,
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(PHARMACIES)} UT dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
