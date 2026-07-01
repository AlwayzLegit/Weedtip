#!/usr/bin/env python3
"""Fetch TX Compassionate Use Program dispensing/pickup locations.

Texas licenses only 3 dispensing organizations statewide (Fluent, Texas
Original, goodblend); DPS's own site lists the companies but not their
pickup addresses. Texas Original's pickup-location map is a public
StoreRocket widget -- queried directly here via its documented API
(storerocket.io/api/user/{id}/locations, found by inspecting the widget's
own JS bundle for its endpoint pattern), filtered to the "TXOG Pickup" /
"Partner Pickup" location types (excluding the ~316 "Prescriber"/clinic
markers also in that dataset, which are physicians, not dispensaries).
Fluent's 2 Texas locations and goodblend's 10 Texas locations have no
public API, so those are hand-transcribed from their own dispensary pages
(getfluent.com/dispensaries/texas, tx.goodblend.com), current as of
2026-07-01. TX is medical-only (low-THC Compassionate Use Program only), so
license_designation is set to "Medical". goodblend's addresses have no zip
in the source page; run scripts/geocode-ca-licenses.py afterward for those.

Usage: python scripts/fetch-tx-licenses.py <out.csv>
"""
import csv
import sys

import requests

STOREROCKET_ID = "vo8xdvw8gn"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]

# Fluent (License #0004) -- getfluent.com/dispensaries/texas/
FLUENT = [
    ("Fluent - Houston", "2620 W Sam Houston Pkwy S", "Houston", "77042", "713-489-3701", 29.7307, -95.5397),
    ("Fluent - Schulenburg", "8381 West US 90", "Schulenburg", "78956", "713-489-3701", 29.6866, -96.9316),
]

# goodblend (License #0006) -- tx.goodblend.com (no zip published)
GOODBLEND = [
    ("Goodblend - South Austin", "7105 E. Riverside Drive", "Austin", "", "", None, None),
    ("Goodblend - San Antonio", "18720 Stone Oak Pkwy, #107", "San Antonio", "", "", None, None),
    ("Goodblend - Plano", "4720 SH-121 N, Suite #180", "Plano", "", "", None, None),
    ("Goodblend - Nacogdoches", "1320 N University Dr", "Nacogdoches", "", "", None, None),
    ("Goodblend - Houston", "9432 Katy Fwy, #400", "Houston", "", "", None, None),
    ("Goodblend - Austin", "2217 Park Bend Dr #300", "Austin", "", "", None, None),
    ("Goodblend - Wichita Falls", "1722 9th St", "Wichita Falls", "", "", None, None),
    ("Goodblend - Fort Worth", "1307 8th Ave Suite #603", "Fort Worth", "", "", None, None),
    ("Goodblend - Colleyville", "6213 Colleyville Blvd, Suite 100", "Colleyville", "", "", None, None),
    ("Goodblend - Missouri City", "4220 Cartwright Rd, Suite 303", "Missouri City", "", "", None, None),
]


def fetch_texas_original():
    r = requests.get(f"https://storerocket.io/api/user/{STOREROCKET_ID}/locations", timeout=30)
    r.raise_for_status()
    locs = r.json()["results"]["locations"]
    out = []
    for loc in locs:
        if not any(f["id"] in (124624, 124625) for f in loc["filters"]):
            continue
        name = loc["name"].removeprefix("TXOG - ")
        out.append((f"Texas Original - {name}", loc["address_line_1"], loc["city"], loc["postcode"],
                     loc["phone"], float(loc["lat"]), float(loc["lng"])))
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "tx-licenses.csv"
    rows = FLUENT + GOODBLEND + fetch_texas_original()
    print(f"fetched {len(rows)} TX dispensing/pickup locations", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, (name, addr, city, zipc, phone, lat, lng) in enumerate(rows):
            w.writerow({
                "business_dba_name": name,
                "business_legal_name": name,
                "license_number": f"TX-DPS-{i + 1:03d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensing Organization)",
                "license_designation": "Medical",
                "premise_street_address": addr,
                "premise_city": city,
                "premise_state": "TX",
                "premise_zip_code": zipc,
                "business_phone": phone or "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": lat if lat else "",
                "premise_longitude": lng if lng else "",
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
