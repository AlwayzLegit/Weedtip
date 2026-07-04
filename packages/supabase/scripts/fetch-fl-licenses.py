#!/usr/bin/env python3
"""Fetch active FL medical marijuana dispensing locations from the Office of
Medical Marijuana Use (OMMU).

Source: knowthefactsmmj.com/mmtc/ (the OMMU's official MMTC page) embeds a
static HTML table of every approved dispensing location (name, address,
city, zip, county) directly in the page markup -- no JS rendering, no API
needed, fetched here with a plain HTTP GET. 767 rows matched the OMMU's
published "767 dispensary locations" figure exactly at fetch time. No
coordinates or phone numbers are present in this table; run
scripts/geocode-ca-licenses.py afterward to fill in coordinates via the free
US Census geocoder. FL is medical-only (no adult-use market), so
license_designation is set to "Medical".

Usage: python scripts/fetch-fl-licenses.py <out.csv>
"""
import csv
import re
import sys

import requests

URL = "https://knowthefactsmmj.com/mmtc/"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "fl-licenses.csv"
    r = requests.get(URL, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    rows = re.findall(
        r"<tr>\s*<td>\s*([^<]+?)\s*</td>\s*<td>([^<]*)</td>\s*<td>([^<]*)</td>\s*"
        r"<td>([^<]*)</td>\s*<td>([^<]*)</td>\s*<td>([^<]*)</td>\s*<td>([^<]*)</td>\s*</tr>",
        r.text, re.S,
    )
    print(f"fetched {len(rows)} FL dispensing locations", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (name, addr, _, _, city, zipc, _county) in enumerate(rows):
            w.writerow({
                "business_dba_name": name.strip(),
                "business_legal_name": name.strip(),
                "license_number": f"FL-OMMU-{i + 1:04d}",
                "license_status": "Active",
                "license_type": "Retail (MMTC Dispensing Location)",
                "license_designation": "Medical",
                "premise_street_address": addr.strip(),
                "premise_city": city.strip(),
                "premise_state": "FL",
                "premise_zip_code": zipc.strip(),
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
