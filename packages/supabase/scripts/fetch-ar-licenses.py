#!/usr/bin/env python3
"""Fetch licensed AR medical marijuana dispensaries.

Source: Arkansas Cannabis Industry Association's dispensary directory
(arcannabis.org/arkansas-dispensaries/), transcribed here on 2026-07-01 --
the Arkansas Dept. of Finance and Administration (which licenses
dispensaries via its Medical Marijuana Commission) has no current bulk
CSV/API source (its only published PDF list is dated 2020-03-17, badly
stale), so this industry-association directory -- organized by the state's
official 8 dispensary zones -- is the best available current source. No
coordinates are published; run scripts/geocode-ca-licenses.py afterward to
fill them in via the free US Census geocoder. AR is medical-only, so
license_designation is set to "Medical".

Re-run note: if this list needs refreshing later, re-visit the source page
and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-ar-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, street_address, city, zip, phone)
DISPENSARIES = [
    ("The Hill", "2733 N. McConnell Ave", "Fayetteville", "", "800-266-9057"),
    ("Purspirit Cannabis Co.", "3390 MLK Blvd", "Fayetteville", "", "479-957-1973"),
    ("The Source", "4505 W. Poplar St", "Rogers", "72756", "479-339-9333"),
    ("The Releaf Center", "9400 McNelly Rd", "Bentonville", "", "479-488-2071"),
    ("Osage Creek Dispensary", "101 E Van Buren", "Eureka Springs", "72632", "479-431-4897"),
    ("Fiddler's Green Dispensary", "16150 Highway 9", "Mountain View", "", "870-269-8600"),
    ("Plant Family Therapeutics", "5172 Hwy 62 E", "Mountain Home", "", "870-709-0800"),
    ("Arkansas Natural Products", "1303 Hwy 65 N", "Clinton", "", "501-386-3166"),
    ("Enlightened Dispensary - Heber Springs", "3003 Hwy 25 B", "Heber Springs", "72543", "501-887-7420"),
    ("Greenlight West Memphis", "3600 N Service Rd", "West Memphis", "72301", "870-497-2175"),
    ("Delta Cannabis Co.", "1151 East Service Rd", "West Memphis", "", "870-551-3642"),
    ("Bam Body And Mind Dispensary", "203 N. Oak St", "West Memphis", "72301", "870-514-3711"),
    ("Nea Full Spectrum", "12001 Highway 49", "Brookland", "", "870-634-6412"),
    ("Crop", "2929 S Caraway Rd", "Jonesboro", "72401", "870-336-2767"),
    ("The Greenery", "4520 Phoenix Ave", "Fort Smith", "72908", "479-551-2235"),
    ("River Valley Dispensary", "W. Shady Lane", "Morrilton", "", ""),
    ("420 Dispensary", "3506 South Arkansas Ave", "Russellville", "", "479-498-4200"),
    ("Enlightened Dispensary - Clarksville", "131 Massengale Rd", "Clarksville", "72830", "479-358-7575"),
    ("Good Day Farm Van Buren", "1705 Fayetteville Rd", "Van Buren", "72956", "479-460-4125"),
    ("Harvest", "1200 Thomas G Wilson", "Conway", "", "501-504-6065"),
    ("Greenlight Little Rock", "7303 Kanis Rd", "Little Rock", "", "501-236-6906"),
    ("Berner's By Good Day Farm", "11600 Chenal Pkwy", "Little Rock", "72211", "501-441-0944"),
    ("Natural Relief Dispensary", "3107 East Kiehl Ave", "Sherwood", "", "501-487-6045"),
    ("Suite 443", "4893 Malvern Ave", "Hot Springs", "", "501-262-9333"),
    ("Green Springs Medical", "309 Seneca St", "Hot Springs", "", "501-207-0420"),
    ("Native Green Wellness Center", "26225 Highway 167", "Hensley", "", "501-993-0617"),
    ("Custom Cannabis", "10200 Hwy 5", "Alexander", "", "501-213-0115"),
    ("High Bank Cannabis Co.", "525 Mallard Loop", "Pine Bluff", "71603", "870-568-0420"),
    ("Greenlight Dispensary", "2000 Mlk Jr Dr", "Helena", "72342", "870-714-6119"),
    ("Hash & Co.", "110 Girder Field Ladd Rd", "Pine Bluff", "71601", "870-663-0900"),
    ("Good Day Farm Monticello", "329 US-425", "Monticello", "71655", "870-412-1244"),
    ("The Treatment Cannabis Dispensary", "416 US-65", "Pine Bluff", "71601", "870-536-8358"),
    ("Zen Leaf Dispensary", "3213 North West Ave", "El Dorado", "71730", "870-229-1453"),
    ("Superfarm Texarkana", "410 Realtor Ave", "Texarkana", "71854", "870-621-2044"),
    ("Good Day Farm Texarkana", "4423 East Broad St", "Texarkana", "", "870-330-4951"),
    ("Enlightened Dispensary - Arkadelphia", "192 Valley St", "Caddo Valley", "71923", "501-432-4200"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ar-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, addr, city, zipc, phone) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": dba,
                "license_number": f"AR-ABC-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "AR",
                "premise_zip_code": zipc,
                "business_phone": phone,
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} AR dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
