#!/usr/bin/env python3
"""Fetch licensed LA medical marijuana pharmacy locations.

Source: Louisiana Dept. of Health's official medical-marijuana page
(ldh.la.gov/bureau-of-sanitarian-services/medical-marijuana), transcribed
here on 2026-07-01 -- there is no CSV/API source, and the list is small and
statutorily capped (10 base permits, each allowed up to 2 satellite
locations; 30 locations total as of this transcription). No coordinates are
published; run scripts/geocode-ca-licenses.py afterward to fill them in via
the free US Census geocoder. LA is medical-only, so license_designation is
set to "Medical".

Re-run note: if this list needs refreshing later, re-visit the source page
and update LOCATIONS below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-la-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, legal_name, street_address, city, zip, phone)
LOCATIONS = [
    ("H & W Acquisition Company", "H & W Acquisition Company LLC", "1667 Tchoupitoulas Blvd., Suite B", "New Orleans", "70130", "504-301-2363"),
    ("H & W Acquisition Company - Metairie", "H & W Acquisition Company LLC", "5055 Veterans Memorial Blvd.", "Metairie", "70006", "504-301-2363"),
    ("Crescent City Therapeutics", "Crescent City Therapeutics, LLC", "100 W. Airline Hwy", "Kenner", "70062", "504-800-6420"),
    ("Crescent City Therapeutics - New Orleans", "Crescent City Therapeutics, LLC", "1407 S. Carrollton Avenue", "New Orleans", "70118", "504-554-0003"),
    ("Capitol Wellness Solutions", "Capitol Wellness Solutions, LLC", "8037 Picardy Avenue", "Baton Rouge", "70809", "225-800-9420"),
    ("Capitol Wellness Solutions - O'Neal Lane", "Capitol Wellness Solutions, LLC", "1940 O'Neal Lane", "Baton Rouge", "70816", "225-529-1420"),
    ("Capitol Wellness Solutions - Prairieville", "Capitol Wellness Solutions, LLC", "17097 Airline Hwy", "Prairieville", "70769", "225-401-6240"),
    ("Green Leaf Dispensary", "Green Leaf Dispensary, LLC", "174 Arlington Street", "Morgan City", "70280", "985-263-3125"),
    ("Green Leaf Dispensary - Houma", "Green Leaf Dispensary, LLC", "6048 W. Park Avenue", "Houma", "70364", "985-360-3372"),
    ("The Apothecary Shoppe", "The Apothecary Shoppe, LLC", "620 Guilbeau Road, Suite A", "Lafayette", "70506", "337-345-4500"),
    ("The Apothecary Shoppe - Opelousas", "The Apothecary Shoppe, LLC", "4079 I-49 S. Service Road", "Opelousas", "70570", "337-345-4500"),
    ("The Apothecary Shoppe - New Iberia", "The Apothecary Shoppe, LLC", "1700 Center Street", "New Iberia", "70560", "337-345-4500"),
    ("Medicis", "Medicis, LLC", "3005 L'Auberge Blvd.", "Lake Charles", "70601", "337-420-8420"),
    ("Medicis - Jennings", "Medicis, LLC", "1920 Evangeline Road", "Jennings", "70546", "337-218-4643"),
    ("Medicis - Sulphur", "Medicis, LLC", "303 South Cities Service Hwy.", "Sulphur", "70663", "337-244-6638"),
    ("The Medicine Cabinet Pharmacy", "The Medicine Cabinet Pharmacy, LLC", "403 Bolton Avenue", "Alexandria", "71301", "318-545-4460"),
    ("The Medicine Cabinet Pharmacy - Marksville", "The Medicine Cabinet Pharmacy, LLC", "114 E. Main Street", "Marksville", "71351", "318-409-0809"),
    ("The Medicine Cabinet Pharmacy - Leesville", "The Medicine Cabinet Pharmacy, LLC", "111 W. Harriet Street", "Leesville", "71446", "318-487-4460"),
    ("Hope Pharmacy", "Hope Pharmacy, LLC", "4590 E. Texas Street", "Bossier City", "71111", "318-402-1819"),
    ("Hope Pharmacy - Natchitoches", "Hope Pharmacy, LLC", "5033 University Parkway", "Natchitoches", "71457", "318-609-1234"),
    ("Hope Pharmacy - Shreveport", "Hope Pharmacy, LLC", "9352 Mansfield Road", "Shreveport", "71118", "318-533-4952"),
    ("Delta Medmar", "Delta Medmar, LLC", "1707 McKeen Place", "Monroe", "71201", "318-855-3381"),
    ("Delta Medmar - West Monroe", "Delta Medmar, LLC", "111 McMillian Road", "West Monroe", "71291", "318-225-4373"),
    ("Delta Medmar - Ruston", "Delta Medmar, LLC", "746 Celebrity Drive", "Ruston", "71270", "318-974-9492"),
    ("Willow Pharmacy", "Willow Pharmacy, Inc.", "69090 Highway 190 Service Road", "Covington", "70433", "985-792-2391"),
    ("Willow Pharmacy - Slidell", "Willow Pharmacy, Inc.", "796 East I-10 Service Road", "Slidell", "70461", "985-288-2660"),
    ("Willow Pharmacy - Hammond", "Willow Pharmacy, Inc.", "1410 SW Railroad Avenue", "Hammond", "70403", "985-520-0099"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "la-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, legal, addr, city, zipc, phone) in enumerate(LOCATIONS):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": f"LA-LDH-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Medical Marijuana Pharmacy)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "LA",
                "premise_zip_code": zipc,
                "business_phone": phone,
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(LOCATIONS)} LA dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
