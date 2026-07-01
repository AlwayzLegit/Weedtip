#!/usr/bin/env python3
"""Fetch licensed DC medical cannabis retailers from Open Data DC.

Source: the DC government's own open-data portal (opendata.dc.gov), dataset
"Licensed Medical Cannabis Retailers" maintained by ABCA (Alcoholic
Beverage & Cannabis Administration) -- fetched via its public GeoJSON export
(no key needed). Only `STATUS == "Active"` retailers are kept ("Emergency
Closure" rows are excluded). DC is medical-cannabis-only under federal
restrictions on commercial adult-use sales, so `license_designation` is set
to "Medical". Already has full address + coordinates (no geocoding needed).

Usage: python scripts/fetch-dc-licenses.py <out.csv>
"""
import csv
import sys

import requests

GEOJSON_URL = "https://opendata.dc.gov/datasets/DCGIS::licensed-medical-cannabis-retailers.geojson"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "dc-licenses.csv"
    r = requests.get(GEOJSON_URL, timeout=60)
    r.raise_for_status()
    features = r.json()["features"]
    active = [f["properties"] for f in features if (f["properties"].get("STATUS") or "").strip() == "Active"]
    print(f"fetched {len(features)} DC retailers; {len(active)} active", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in active:
            w.writerow({
                "business_dba_name": row.get("TRADE_NAME") or row.get("FACILITY_NAME", ""),
                "business_legal_name": row.get("ENTITY_NAME", ""),
                "license_number": row.get("ABCA_NUMBER", ""),
                "license_status": "Active",
                "license_type": "Retail (Medical Cannabis Retailer)",
                "license_designation": "Medical",
                "premise_street_address": row.get("ADDRESS", ""),
                "premise_city": "Washington",
                "premise_state": "DC",
                "premise_zip_code": "",
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": row.get("LATITUDE"),
                "premise_longitude": row.get("LONGITDUE"),
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
