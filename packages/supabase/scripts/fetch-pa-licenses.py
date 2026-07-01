#!/usr/bin/env python3
"""Fetch licensed PA medical marijuana dispensaries from PASDA (Pennsylvania
Spatial Data Access).

Source: the PA Department of Health publishes an official GeoJSON dataset
via PASDA (pasda.psu.edu), linked from OpenDataPhilly -- fetched directly
here, no key needed. Snapshot dated January 2024. Already has full address +
coordinates + phone + website. PA is medical-only (no adult-use market), so
license_designation is set to "Medical".

Usage: python scripts/fetch-pa-licenses.py <out.csv>
"""
import csv
import sys

import requests

GEOJSON_URL = "https://www.pasda.psu.edu/json/DOH_MedicalMarijuanaDispensaries202401.geojson"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "pa-licenses.csv"
    r = requests.get(GEOJSON_URL, timeout=60)
    r.raise_for_status()
    features = r.json()["features"]
    print(f"fetched {len(features)} PA dispensaries", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, feat in enumerate(features):
            p = feat["properties"]
            w.writerow({
                "business_dba_name": p.get("FACILITY_N", ""),
                "business_legal_name": p.get("FACILITY_N", ""),
                "license_number": f"PA-DOH-{i + 1:04d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "Medical",
                "premise_street_address": p.get("STREET", ""),
                "premise_city": p.get("CITY", ""),
                "premise_state": "PA",
                "premise_zip_code": p.get("ZIP_CODE", ""),
                "business_phone": p.get("TELEPHONE_", ""),
                "business_website": p.get("FACILITY_U", ""),
                "business_email": "",
                "premise_latitude": p.get("LATITUDE"),
                "premise_longitude": p.get("LONGITUDE"),
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
