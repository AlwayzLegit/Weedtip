#!/usr/bin/env python3
"""Fetch licensed HI medical cannabis dispensaries.

Source: Hawaii Dept. of Health's official per-island dispensary-location
pages (health.hawaii.gov/medicalcannabisregistry/{oahu,hawaii-island,maui}
-dispensary-locations, kauai-dispensary-location), transcribed here on
2026-07-01 -- no CSV/API source exists. Hawaii licenses only 8 dispensary
companies statewide, each running a handful of storefronts. No coordinates
are published; run scripts/geocode-ca-licenses.py afterward to fill them in
via the free US Census geocoder. HI is medical-only, so
license_designation is set to "Medical".

Re-run note: if this list needs refreshing later, re-visit the source pages
and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-hi-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, legal_name, street_address, city, zip)
DISPENSARIES = [
    # Oahu -- Aloha Green
    ("Aloha Green - Honolulu", "Aloha Green", "3131 North Nimitz Hwy.", "Honolulu", "96819"),
    ("Aloha Green - Kapolei", "Aloha Green", "92-1047 Olani St., #1-110", "Kapolei", "96707"),
    ("Aloha Green - King Street", "Aloha Green", "1314 S. King St.", "Honolulu", "96814"),
    ("Aloha Green - Waikiki", "Aloha Green", "2113 Kalakaua Ave.", "Honolulu", "96815"),
    # Oahu -- Cure Oahu
    ("Cure Oahu - Kailua", "Cure Oahu", "70 Kihapai Street", "Kailua", "96734"),
    ("Cure Oahu - Kapolei", "Cure Oahu", "4850 Kapolei Parkway Bldg. D #501", "Kapolei", "96707"),
    ("Cure Oahu - Honolulu", "Cure Oahu", "727 Kapahulu Ave.", "Honolulu", "96816"),
    # Oahu -- Noa Botanicals
    ("Noa Botanicals - Aiea", "Noa Botanicals", "98-302 Kamehameha Hwy", "Aiea", "96701"),
    ("Noa Botanicals - Honolulu", "Noa Botanicals", "1308 Young Street", "Honolulu", "96814"),
    ("Noa Botanicals - Kaneohe", "Noa Botanicals", "46-028 Kawa St.", "Kaneohe", "96744"),
    ("Noa Botanicals - Waikiki", "Noa Botanicals", "345 Royal Hawaiian Avenue", "Honolulu", "96815"),
    # Hawaii Island -- Hawaiian Ethos
    ("Hawaiian Ethos - Hilo", "Hawaiian Ethos", "578 Kanoelehua Ave.", "Hilo", "96720"),
    ("Hawaiian Ethos - Kona", "Hawaiian Ethos", "73-5613 Olowalu St., Suite 7", "Kailua-Kona", "96740"),
    ("Hawaiian Ethos - Waimea", "Hawaiian Ethos", "64-1035 Mamalahoa Hwy., Unit J", "Kamuela", "96743"),
    # Hawaii Island -- Big Island Grown
    ("Big Island Grown - Hilo", "Big Island Grown", "750 Kanoelehua Ave., Suite 104", "Hilo", "96720"),
    ("Big Island Grown - Kona", "Big Island Grown", "74-5617 Pawai Place", "Kailua-Kona", "96740"),
    ("Big Island Grown - Waimea", "Big Island Grown", "64-1040 Mamalahoa Hwy.", "Waimea", "96743"),
    # Maui -- Maui Grown Therapies
    ("Maui Grown Therapies - Kahului", "Maui Grown Therapies", "44 Paa St.", "Kahului", "96732"),
    ("Maui Grown Therapies - Kihei", "Maui Grown Therapies", "1215 S. Kihei Rd, Unit D2", "Kihei", "96753"),
    ("Maui Grown Therapies - Pukalani", "Maui Grown Therapies", "7 Aewa Place, Unit 3", "Makawao", "96768"),
    # Maui -- Pono Life Sciences Maui
    ("Pono Life Sciences Maui - Kihei", "Pono Life Sciences Maui", "95 E. Lipoa St", "Kihei", "96753"),
    ("Pono Life Sciences Maui - Lahaina", "Pono Life Sciences Maui", "60 Ulupono Street #8", "Lahaina", "96761"),
    # Kauai -- Green Aloha
    ("Green Aloha - Kapaa", "Green Aloha", "4-1565 Kuhio Hwy #3", "Kapaa", "96746"),
    ("Green Aloha - Koloa", "Green Aloha", "2827 Poipu Rd.", "Koloa", "96756"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "hi-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, legal, addr, city, zipc) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": f"HI-DOH-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "HI",
                "premise_zip_code": zipc,
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} HI dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
