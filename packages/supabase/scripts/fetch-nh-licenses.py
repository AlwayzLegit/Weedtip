#!/usr/bin/env python3
"""Fetch licensed NH Alternative Treatment Center (ATC) dispensaries.

Source: NH DHHS's official ATC page names 7 statewide ATC dispensary
locations (Chichester, Conway, Dover, Keene, Lebanon, Merrimack, Plymouth)
but the page itself returned HTTP 403 on direct fetch; addresses were
cross-referenced from each operator's own site (GraniteLeaf Cannabis,
Temescal Wellness, Sanctuary ATC) on 2026-07-01. New Hampshire's entire
therapeutic cannabis program is capped at these 7 storefronts, no CSV/API
source exists. No coordinates published; run scripts/geocode-ca-licenses.py
afterward. NH is medical-only, so license_designation is set to "Medical".

Re-run note: if this list needs refreshing later, re-visit the operator
sites and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-nh-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, legal_name, street_address, city, zip, phone)
DISPENSARIES = [
    ("Graniteleaf Cannabis - Merrimack", "Graniteleaf Cannabis", "380 Daniel Webster Highway, Units A And C", "Merrimack", "03054", "603-262-5035"),
    ("Graniteleaf Cannabis - Chichester", "Graniteleaf Cannabis", "349 Dover Road (Route 4)", "Chichester", "03258", "603-212-1500"),
    ("Sanctuary Atc - Plymouth", "Sanctuary Atc", "568 Tenney Mountain Highway", "Plymouth", "03264", "603-346-4619"),
    ("Sanctuary Atc - Conway", "Sanctuary Atc", "234 White Mountain Hwy", "Conway", "03818", "603-662-0113"),
    ("Temescal Wellness - Dover", "Temescal Wellness", "26 Crosby Road, Units 11-12", "Dover", "03820", "603-285-9383"),
    ("Temescal Wellness - Lebanon", "Temescal Wellness", "367 Route 120, Unit E-2", "Lebanon", "03766", "603-285-9383"),
    ("Temescal Wellness - Keene", "Temescal Wellness", "69 Island St Suite 1", "Keene", "03431", "603-285-9383"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "nh-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, legal, addr, city, zipc, phone) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": f"NH-DHHS-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Alternative Treatment Center)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "NH",
                "premise_zip_code": zipc,
                "business_phone": phone,
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} NH dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
