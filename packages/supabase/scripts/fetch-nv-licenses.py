#!/usr/bin/env python3
"""Fetch NV licensed dispensary locations from the Cannabis Compliance Board's
public retail-location maps.

Source: the CCB's own "List of Retailers" page (ccb.nv.gov/list-of-licensees/)
links to two Google My Maps (Northern Nevada, Southern Nevada) maintained by
the agency itself -- fetched here via Google's public KML export endpoint
(https://www.google.com/maps/d/kml?mid=...&forcekml=1). This is the only
source found with both name AND coordinates: the CCB's own downloadable
"Active License List" spreadsheet has no address/coordinate columns at all
(only county), and the Cannlytics `cannabis_licenses` NV mirror is derived
from that same license list, so it's equally addressless. The KML maps have
no street address either, only lat/lng and a city-region folder name -- good
enough to place a pin and pass the importer's NOT NULL location constraint,
though `address` is left blank. No license numbers are available from this
source (dedup relies on generated slugs, not license numbers).

Usage: python scripts/fetch-nv-licenses.py <out.csv>
"""
import re
import sys

import requests

MAPS = {
    "north": "1IdhJppStt8zMlifqT3LNUkOswg9kMmg",
    "south": "1BGgNVyRx-R9zVuAAk3huY6VZl5ouIes",
}
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def fetch_kml(mid):
    url = f"https://www.google.com/maps/d/kml?mid={mid}&forcekml=1"
    r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    return r.text


def parse_placemarks(kml_text):
    out = []
    for city, body in re.findall(r"<Folder>\s*<name>(.*?)</name>(.*?)</Folder>", kml_text, re.S):
        city = city.split("/")[0].strip()
        for name, coords in re.findall(
            r"<Placemark>\s*<name>(.*?)</name>.*?<coordinates>\s*([^<]+?)\s*</coordinates>", body, re.S
        ):
            lng, lat, *_ = coords.split(",")
            out.append((name.strip(), city, lat.strip(), lng.strip()))
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "nv-licenses.csv"
    rows = []
    for label, mid in MAPS.items():
        kml = fetch_kml(mid)
        placemarks = parse_placemarks(kml)
        print(f"{label}: {len(placemarks)} placemarks", flush=True)
        rows.extend(placemarks)
    print(f"fetched {len(rows)} NV dispensary locations total", flush=True)

    import csv
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for name, city, lat, lng in rows:
            w.writerow({
                "business_dba_name": name,
                "business_legal_name": name,
                "license_number": "",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "",
                "premise_street_address": "",
                "premise_city": city,
                "premise_state": "NV",
                "premise_zip_code": "",
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": lat,
                "premise_longitude": lng,
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
