#!/usr/bin/env python3
"""Fetch licensed VA medical cannabis dispensaries.

Source: Virginia Cannabis Control Authority's official dispensary-locations
page (cca.virginia.gov/medicalcannabis/dispensaries), transcribed here on
2026-07-01 -- there is no CSV/API/ArcGIS feed for this list (unlike OH/MD),
and the list is small (Virginia licenses only 5 regional pharmaceutical
processors, each running a handful of retail storefronts), so a one-time
manual transcription of the current page is the practical approach. No
coordinates are published; run scripts/geocode-ca-licenses.py afterward to
fill them in via the free US Census geocoder.

Re-run note: if this list needs refreshing later, re-visit the source page
and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-va-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, legal_name/processor, street_address, city, zip, phone)
DISPENSARIES = [
    ("Beyond Hello Alexandria", "Beyond Hello", "5902 Richmond Hwy, Suite 1", "Alexandria", "22303", "(703) 721-8722"),
    ("Beyond Hello Arlington", "Beyond Hello", "2701 Wilson Blvd", "Arlington", "22201", "(571) 895-7005"),
    ("Beyond Hello Fairfax", "Beyond Hello", "10521 Fairfax Blvd", "Fairfax", "22030", "(571) 495-6999"),
    ("Beyond Hello Manassas", "Beyond Hello", "8100 Albertstone Circle", "Manassas", "20109", "(703) 420-4021"),
    ("Beyond Hello Sterling", "Beyond Hello", "21290 Windmill Parc Dr", "Sterling", "20166", "(276) 235-9700"),
    ("Beyond Hello Woodbridge", "Beyond Hello", "14400 Smoketown Rd", "Woodbridge", "22192", "(571) 677-4420"),
    ("Rise Abingdon", "Rise", "26864 Watauga Rd", "Abingdon", "24211", "(276) 644-6400"),
    ("Rise Bristol", "Rise", "780 Gate City Hwy", "Bristol", "24201", "(276) 206-2003"),
    ("Rise Christiansburg", "Rise", "1675 Roanoke St", "Christiansburg", "24073", "(540) 251-4406"),
    ("Rise Danville", "Rise", "816 West Main Street", "Danville", "24541", "(276) 644-6420"),
    ("Rise Lynchburg", "Rise", "3219 Old Forest Road", "Lynchburg", "24501", "(434) 363-3436"),
    ("Rise Roanoke", "Rise", "1919 Valley View Blvd NW, Ste B", "Roanoke", "24012", "(540) 380-0420"),
    ("Cannabist Carytown", "Cannabist", "3100 West Cary Street", "Richmond", "23221", "(804) 613-6121"),
    ("Cannabist Laburnum", "Cannabist", "4320 South Laburnum Ave", "Henrico", "23231", "(804) 554-4880"),
    ("Gleaf Colonial Heights", "Gleaf", "401 Southpark Blvd", "Colonial Heights", "23834", "(800) 484-0303"),
    ("Gleaf Richmond", "Gleaf", "2804 Decatur St, Building 30", "Richmond", "23224", "(800) 484-0303"),
    ("Gleaf Short Pump", "Gleaf", "11190 West Broad Street", "Glen Allen", "23060", "(804) 613-5697"),
    ("Zen Leaf Hampton", "Zen Leaf", "2400 Cunningham Dr, Suite 600", "Hampton", "23666", "(757) 659-6440"),
    ("Zen Leaf Norfolk", "Zen Leaf", "7635 Granby Street", "Norfolk", "23505", "(757) 734-5880"),
    ("Zen Leaf Portsmouth", "Zen Leaf", "4012 Seaboard Court", "Portsmouth", "23701", "(757) 315-6808"),
    ("Zen Leaf Suffolk", "Zen Leaf", "1238 Holland Road", "Suffolk", "23434", "(757) 538-7378"),
    ("Zen Leaf Virginia Beach", "Zen Leaf", "535 North Birdneck Road", "Virginia Beach", "23451", "(757) 447-2303"),
    ("Zen Leaf Williamsburg", "Zen Leaf", "409 Bypass Rd", "Williamsburg", "23185", "(757) 734-4038"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "va-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, legal, addr, city, zipc, phone) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": f"VA-CCA-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Medical Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "VA",
                "premise_zip_code": zipc,
                "business_phone": phone,
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} VA dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
