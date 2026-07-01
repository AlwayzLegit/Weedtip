#!/usr/bin/env python3
"""Fetch licensed GA medical cannabis dispensaries.

Source: the GA Access to Medical Cannabis Commission's official dispensary
page (gmcc.ga.gov/patients/dispensaries) embeds a public Google My Maps map
(mid=1R0lW9jVe3EyfGQk3NGxOeLDV2Nr1FKY) with full addresses, coordinates, and
license numbers in each placemark's description -- fetched via Google's KML
export endpoint on 2026-07-01 and hand-cleaned here (the raw KML descriptions
interleave a "d/b/a Brand Name" line ahead of the street address for some
entries, which a regex parse mangled into the street field; only 17 rows, so
transcribing cleanly by hand was more reliable than patching the regex). GA
is medical-only, so license_designation is set to "Medical".

Re-run note: if this list needs refreshing later, re-fetch
https://www.google.com/maps/d/kml?mid=1R0lW9jVe3EyfGQk3NGxOeLDV2Nr1FKY&forcekml=1
and update DISPENSARIES below.

Usage: python scripts/fetch-ga-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, legal_name, street_address, city, zip, license_number, lat, lng)
DISPENSARIES = [
    ("Trulieve Macon", "Trulieve Medical Cannabis Dispensary of Macon", "3556 Riverside Drive, Suite A", "Macon", "31210", "DISP0001", 32.8975623, -83.6833325),
    ("Trulieve Marietta", "Trulieve Medical Cannabis Dispensary of Marietta", "220 Cobb Parkway North, Suite 600", "Marietta", "30062", "DISP0002", 33.9556006, -84.5225041),
    ("Trulieve Pooler", "Trulieve Medical Cannabis Dispensary of Pooler", "2003 Pooler Parkway", "Pooler", "31322", "DISP0003", 32.0811698, -81.2799086),
    ("Botanical Sciences Marietta", "Georgia Dispensary 3, LLC dba Botanical Sciences", "2468 Windy Hill Rd, Suite 900", "Marietta", "30067", "DISP0004", 33.902355, -84.4816349),
    ("Botanical Sciences Pooler", "Georgia Dispensary 4, LLC dba Botanical Sciences", "100 Zoya Lane, Suite 112", "Pooler", "31322", "DISP0005", 32.0870758, -81.2769441),
    ("Trulieve Newnan", "Trulieve Medical Cannabis Dispensary of Newnan", "1690 Highway 34 East, Suite D", "Newnan", "30265", "DISP0006", 33.4018397, -84.7251988),
    ("Botanical Sciences Chamblee", "Georgia Dispensary 1, LLC dba Botanical Sciences", "3927 Buford Hwy NE", "Atlanta", "30345", "DISP0007", 33.8579104, -84.3114939),
    ("Botanical Sciences Stockbridge", "Georgia Dispensary 2, LLC dba Botanical Sciences", "1791 Rock Quarry Rd", "Stockbridge", "30281", "DISP0008", 33.5079524, -84.2289087),
    ("Trulieve Evans", "Trulieve Medical Cannabis Dispensary of Evans", "4218 Washington Rd, Unit 1", "Evans", "30809", "DISP0009", 33.523809, -82.121703),
    ("Fine Fettle Smyrna", "FFD GA Smyrna LLC d/b/a Fine Fettle", "2110 Paces Ferry Road SE", "Smyrna", "30080", "DISP0011", 33.8643372, -84.4916136),
    ("Fine Fettle Decatur", "FFD GA Decatur LLC d/b/a Fine Fettle", "2607 Lawrenceville Highway", "Decatur", "30033", "DISP0013", 33.8228465, -84.2620781),
    ("Fine Fettle Athens", "FFD GA Athens LLC", "3035 Atlanta Highway", "Athens", "30606", "DISP0012", 33.9431955, -83.439548),
    ("Trulieve Columbus", "Trulieve Medical Cannabis Dispensary of Columbus", "4328 Armour Road", "Columbus", "31904", "DISP0014", 32.5042004, -84.9522879),
    ("Treevana Milledgeville", "Treevana Remedy, Inc.", "3015 Heritage Place, Suite B", "Milledgeville", "31061", "DISP0015", 33.1182227, -83.259218),
    ("Botanical Sciences Atlanta", "Georgia Dispensary 6, LLC d/b/a Botanical Sciences", "1532 Howell Mill Rd.", "Atlanta", "30318", "DISP0018", 33.7974041, -84.4164236),
    ("True Bliss Atlanta", "TT GA Retail 3 LLC d/b/a True Bliss Dispensary", "66 Peachtree Street NW", "Atlanta", "30303", "DISP0017", 33.7556122, -84.3890696),
    ("Fine Fettle Evans", "FFD GA Evans LLC", "4300 Towne Centre", "Evans", "30809", "DISP0020", 33.5322068, -82.1261091),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ga-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for dba, legal, addr, city, zipc, lic, lat, lng in DISPENSARIES:
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": legal,
                "license_number": lic,
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "GA",
                "premise_zip_code": zipc,
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": lat,
                "premise_longitude": lng,
            })
    print(f"wrote {len(DISPENSARIES)} GA dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
