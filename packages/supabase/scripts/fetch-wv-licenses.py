#!/usr/bin/env python3
"""Fetch licensed WV medical cannabis dispensaries.

Source: WV Office of Medical Cannabis's official current dispensary-list
PDF (omc.wv.gov, "WV Licensed Medical Cannabis Facilities - Dispensary
List"), transcribed here on 2026-07-01 -- no CSV/API source exists. 63
active dispensaries with address + county + phone. No coordinates are
published; run scripts/geocode-ca-licenses.py afterward to fill them in via
the free US Census geocoder. WV is medical-only, so license_designation is
set to "Medical". The Elkins entry's zip in the source PDF (25801) appears
to be a copy-paste artifact duplicating Beckley's zip -- left blank here
rather than passed through, to avoid geocoding to the wrong city.

Re-run note: if this list needs refreshing later, re-visit the source PDF
and update DISPENSARIES below -- there's no live feed to re-fetch.

Usage: python scripts/fetch-wv-licenses.py <out.csv>
"""
import csv
import sys

# (dba_name, street_address, city, zip, phone)
DISPENSARIES = [
    ("Barboursville Cannabis Company", "2A Mall Rd.", "Barboursville", "25504", "304-949-8588"),
    ("Cannabist - Beckley", "300 Galleria Plz # 308", "Beckley", "25801", "304-362-0518"),
    ("Greenlight - Beckley", "4244 Robert C Byrd Dr.", "Beckley", "25801", "304-860-1058"),
    ("The Landing Dispensary - Beckley", "2810 Robert C Byrd Dr.", "Beckley", "25801", "681-387-7849"),
    ("Trulieve - Beckley", "1000 N Eisenhower Dr.", "Beckley", "25801", "681-666-3143"),
    ("Country Grown Cannabis - Beckley", "93 Hickory Dr.", "Beckley", "25801", "304-256-0346"),
    ("Trulieve - Belle", "2700 E Dupont Ave. Ste 9", "Belle", "25015", "304-486-3049"),
    ("The Landing Dispensary - Bridgeport", "1048 Anmoore Rd", "Bridgeport", "26330", "681-387-7847"),
    ("Zen Leaf - Buckhannon", "120 Buckhannon Xrds St 104", "Buckhannon", "", "304-470-0936"),
    ("Country Grown Cannabis - Charles Town", "672 E Washington St.", "Charles Town", "25414", "304-930-1456"),
    ("Greene Street Cannabis Co. - Charleston", "5126 Maccorkle Ave SE", "Charleston", "25304", "304-306-0679"),
    ("Kanacare Health - Charleston", "5703 Maccorkle Ave SE Suite 110", "Charleston", "25304", "681-205-2085"),
    ("The Landing Dispensary - Charleston", "4002 Maccorkle Ave SE Suite 1", "Charleston", "25304", "681-387-7842"),
    ("The Next Level Wellness #4 - Clarksburg", "742 W Pike St.", "Clarksburg", "26301", "304-969-1633"),
    ("Zen Leaf - Clarksburg", "254 Emily Dr.", "Clarksburg", "26301", "681-600-3110"),
    ("Greene Street Cannabis Co. - Cross Lanes", "125 Lakeview Dr. Ste D", "Cross Lanes", "25313", "304-564-6017"),
    ("Country Grown Cannabis - Dunbar", "1005 Dunbar Ave.", "Dunbar", "25064", "304-768-3930"),
    ("Greenlight - Elkins", "6 Chemistry Dr.", "Elkins", "", "304-621-6156"),
    ("NewLeaf - Fairmont", "161 Middletown Circle Ste 2", "Fairmont", "26554", "304-460-0707"),
    ("The Riverside Dispensary - Fairmont", "501 Merchant St.", "Fairmont", "26554", "681-404-6020"),
    ("Country Grown Cannabis Dispensary - Fairmont", "9685 Mall Loop # 3467", "Fairmont", "26554", "304-816-3236"),
    ("Cannabist - Huntington", "917 3rd Ave", "Huntington", "25701", "681-500-3501"),
    ("C By Country Grown - Huntington", "2689 5th Ave", "Huntington", "25702", "681-378-6175"),
    ("Huntington Gardens - Huntington", "1338 3rd Ave", "Huntington", "25701", "681-378-2848"),
    ("NewLeaf - Huntington", "2018 3rd Ave", "Huntington", "25703", "304-578-5266"),
    ("The Landing Dispensary - Huntington", "1824 US Rt 60", "Huntington", "25705", "681-387-7844"),
    ("Trulieve - Huntington", "2013 5th Ave", "Huntington", "26201", "304-699-0440"),
    ("Trulieve - Hurricane", "2 Putnam Village Dr. Ste 2-3", "Hurricane", "25526", "304-779-8604"),
    ("The Landing Dispensary - Hurricane", "3761 Teays Valley Rd", "Hurricane", "25526", "681-387-7833"),
    ("Country Grown Cannabis - Inwood", "791 Middleway Pike Unit 11A", "Inwood", "25428", "304-821-4347"),
    ("The Next Level Wellness #5 - Kingwood", "107B Pleasant Ave.", "Kingwood", "26537", "304-969-1633"),
    ("Greenlight - Lewisburg", "1747 Jefferson St. N", "Lewisburg", "24901", "304-520-4175"),
    ("Country Grown Cannabis - Logan", "201 George Kostas Dr.", "Logan", "25601", "304-752-5244"),
    ("Country Grown Cannabis - Martinsburg", "1321 Edwin Miller Blvd.", "Martinsburg", "25404", "304-350-1054"),
    ("NewLeaf - Martinsburg", "776 Foxcroft Ave.", "Martinsburg", "25401", "304-578-5255"),
    ("Trulieve - Milton", "5 Perry Morris Square, US Rt 60", "Milton", "25541", "304-635-5046"),
    ("Cannabist - Morgantown", "225 Don Knotts Blvd.", "Morgantown", "26501", "304-244-5178"),
    ("NewLeaf - Morgantown", "3227 Earl L Core Rd.", "Morgantown", "26508", "304-712-2030"),
    ("Trulieve - Morgantown", "525 Granville Sq. Ste 101", "Morgantown", "26501", "304-449-5304"),
    ("The Green House Dispensary - Morgantown", "2045 University Ave. B", "Morgantown", "26505", "304-212-5249"),
    ("The Landing Dispensary - Morgantown", "63 Don Knotts Blvd.", "Morgantown", "26501", "681-387-7832"),
    ("Trulieve - Morgantown 2", "1397 Earl L Core Rd.", "Morgantown", "26505", "304-381-6721"),
    ("Zen Leaf - Morgantown", "205 Venture Dr.", "Morgantown", "26508", "681-376-0011"),
    ("The Landing Dispensary - Parkersburg", "3914 Murdoch Ave. Unit 7", "Parkersburg", "26105", "681-387-7845"),
    ("Trulieve - Parkersburg", "152 Park Center Dr.", "Parkersburg", "26101", "304-470-4833"),
    ("Verdant Creations - Parkersburg", "1255 1/2-A Gihon Rd.", "Parkersburg", "26101", "304-679-1110"),
    ("Kanacare - Parkersburg", "808 Division St.", "Parkersburg", "26101", "681-229-1350"),
    ("Greenlight - Princeton", "112 Expert Circle", "Princeton", "24740", "304-250-3029"),
    ("The Orchard Dispensary - Romney", "22 Hannas Rd.", "Romney", "26757", "304-359-2050"),
    ("NewLeaf - South Charleston", "2390 Mountaineer Blvd.", "South Charleston", "25309", "304-896-9611"),
    ("Trulieve - South Charleston", "4701 Maccorkle Ave. SW #200", "South Charleston", "25309", "304-407-2434"),
    ("Cannabist - St. Albans", "603 3rd Ave.", "St. Albans", "25177", "304-693-2705"),
    ("Greenlight Dispensary - Stollings", "351 Hanging Rock Hwy.", "Stollings", "25646", "304-953-2018"),
    ("Greenlight Dispensary - Summersville", "1007 Industrial Dr. Suite A", "Summersville", "26651", "681-628-0275"),
    ("NewLeaf - Triadelphia", "355 Wayfarer Dr.", "Triadelphia", "26059", "304-578-3231"),
    ("The Foundry - Weirton", "4075 Main St. B", "Weirton", "26062", "304-914-4090"),
    ("The Next Level Wellness - Weston", "166 Berlin Rd.", "Weston", "26452", "304-969-1633"),
    ("Trulieve - Weston", "137 Staunton Dr.", "Weston", "26452", "304-407-3288"),
    ("Zen Leaf - Westover", "871 Fairmont Rd.", "Westover", "26501", "681-376-0032"),
    ("Country Grown Cannabis - Wheeling", "2085 National Rd.", "Wheeling", "26003", "304-905-8019"),
    ("Zen Leaf - Wheeling", "231-237 Warwood Ave.", "Wheeling", "26003", "304-907-4973"),
    ("Kanacare - White Hall", "101 Tygart Mall Loop #102A", "White Hall", "26554", "304-816-3096"),
    ("Cannabist - Williamstown", "76 Thunder Rd.", "Williamstown", "26187", "304-440-9703"),
]
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "wv-licenses.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (dba, addr, city, zipc, phone) in enumerate(DISPENSARIES):
            w.writerow({
                "business_dba_name": dba,
                "business_legal_name": dba,
                "license_number": f"WV-OMC-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "WV",
                "premise_zip_code": zipc,
                "business_phone": phone,
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(DISPENSARIES)} WV dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
