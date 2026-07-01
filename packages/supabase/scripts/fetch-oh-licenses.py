#!/usr/bin/env python3
"""Fetch licensed OH cannabis dispensaries from the Division of Cannabis
Control's live ArcGIS feature service.

Source: the DCC's official "Ohio Medical Marijuana Dispensaries" ArcGIS
dashboard (found via com.ohio.gov's dispensary-locator links) is backed by a
public, unauthenticated FeatureServer at
services2.arcgis.com/MlJ0G8iWUyC7jAmu/.../Geocoded_Dispensaries/FeatureServer/0
-- queried directly here (no key needed). Despite the "Medical" name in the
dashboard title, `USER_Type` values also include adult-use-only entries;
license_designation is left blank since Ohio's dual-use licensing means most
locations serve both medical and adult-use customers (importer defaults both
flags true when designation is empty, same treatment as AZ). Already has
full address + coordinates + phone (no geocoding needed).

Usage: python scripts/fetch-oh-licenses.py <out.csv>
"""
import csv
import sys

import requests

FEATURE_SERVER = (
    "https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/"
    "Geocoded_Dispensaries/FeatureServer/0/query"
)
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "oh-licenses.csv"
    r = requests.get(FEATURE_SERVER, params={"where": "1=1", "outFields": "*", "f": "json"}, timeout=60)
    r.raise_for_status()
    data = r.json()
    features = [f["attributes"] for f in data.get("features", [])]
    active = [row for row in features if (row.get("USER_License_Status") or "").strip() == "Active"]
    print(f"fetched {len(features)} OH dispensaries; {len(active)} active", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in active:
            w.writerow({
                "business_dba_name": row.get("USER_Dispensary_Name__DBA_") or row.get("USER_Business_Name", ""),
                "business_legal_name": row.get("USER_Business_Name", ""),
                "license_number": row.get("USER_License__", ""),
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "",
                "premise_street_address": row.get("USER_Street_Address", ""),
                "premise_city": row.get("USER_City", ""),
                "premise_state": "OH",
                "premise_zip_code": row.get("USER_ZIP", ""),
                "business_phone": row.get("USER_Phone", ""),
                "business_website": "",
                "business_email": "",
                "premise_latitude": row.get("USER_Lat"),
                "premise_longitude": row.get("USER_Lon"),
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
