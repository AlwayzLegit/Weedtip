#!/usr/bin/env python3
"""Fetch licensed RI cannabis compassion centers (dispensaries).

Source: RI Cannabis Control Commission's official licensed-compassion-
centers page (ccc.ri.gov/cannabis-office/cannabis-and-hemp-licenses/
compassion-centers/licensed-compassion-centers), transcribed here on
2026-07-01 -- there is no CSV/API source, and the list is small (Rhode
Island's entire retail market is 9 compassion centers, unchanged for years
under a capped-license model). No coordinates are published; run
scripts/geocode-ca-licenses.py afterward to fill them in via the free US
Census geocoder.

Re-run note: if this list needs refreshing later, re-visit the source page
and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-ri-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, legal_name, street_address, city, zip, phone)
DISPENSARIES = [
    ("Thomas C. Slater Compassion Center", "Thomas C. Slater Compassion Center", "1 Corliss Street", "Providence", "02904", "401-274-1000"),
    ("Newport Cannabis Co.", "Ocean State Controlled Botanicals", "1637 West Main Road", "Portsmouth", "02871", "401-293-5987"),
    ("Rise Warwick", "Summit Medical Compassion Center", "444 Quaker Lane", "Warwick", "02886", "401-889-3990"),
    ("Sweetspot Dispensary", "Plant Based Compassionate Care", "560 South County Trail, Building B", "Exeter", "02822", "401-271-3869"),
    ("Aura Of Rhode Island", "Aura of Rhode Island, Inc.", "1136 Lonsdale Avenue", "Central Falls", "02806", "401-335-5356"),
    ("Mother Earth Wellness", "Mother Earth Wellness Inc.", "125 Esten Avenue", "Pawtucket", "02860", "401-352-4300"),
    ("Solar Cannabis Co.", "Solar Therapeutics Rhode Island", "65 Meadow Street, Unit A", "Warwick", "02886", "401-642-1919"),
    ("Green Wave CC", "Green Wave CC, LLC", "187 Danielson Pike", "Foster", "02825", "774-203-8551"),
    ("New Leaf Compassion Center", "New Leaf Compassion Center, Inc.", "2000 Diamond Hill Road", "Woonsocket", "02895", ""),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ri-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, legal, addr, city, zipc, phone) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": f"RI-CCC-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Compassion Center)",
                "license_designation": "",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "RI",
                "premise_zip_code": zipc,
                "business_phone": phone,
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} RI dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
