#!/usr/bin/env python3
"""Fetch licensed MD cannabis dispensaries from the Maryland Cannabis
Administration's live ArcGIS feature service.

Source: the MCA's own "MCA Dispensary Map" (linked from
cannabis.maryland.gov/pages/licensed-dispensary-locations.aspx) is backed by
a public, unauthenticated FeatureServer --
services.arcgis.com/njFNhDsUCentVYJW/.../MCA_Licensed_Dispensaries_List_view_API
-- queried directly here (no key needed). All 116 records carry
`au_med == "Medical & Adult-Use"` (MD converted all medical licenses to dual
medical+adult-use), so both flags are set true unconditionally. Already has
full address + coordinates + website (no geocoding needed).

Usage: python scripts/fetch-md-licenses.py <out.csv>
"""
import csv
import sys

import requests

FEATURE_SERVER = (
    "https://services.arcgis.com/njFNhDsUCentVYJW/arcgis/rest/services/"
    "MCA_Licensed_Dispensaries_List_view_API/FeatureServer/0/query"
)
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "md-licenses.csv"
    r = requests.get(FEATURE_SERVER, params={"where": "1=1", "outFields": "*", "f": "json"}, timeout=60)
    r.raise_for_status()
    data = r.json()
    features = [f["attributes"] for f in data.get("features", [])]
    print(f"fetched {len(features)} MD dispensaries", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in features:
            addr = row.get("Address") or ""
            if row.get("Address_2"):
                addr = f"{addr} {row['Address_2']}"
            w.writerow({
                "business_dba_name": row.get("dba") or row.get("name", ""),
                "business_legal_name": row.get("name", ""),
                "license_number": row.get("license_number", ""),
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "",
                "premise_street_address": addr,
                "premise_city": row.get("City", ""),
                "premise_state": "MD",
                "premise_zip_code": row.get("Zip", ""),
                "business_phone": "",
                "business_website": row.get("url", ""),
                "business_email": "",
                "premise_latitude": row.get("lat"),
                "premise_longitude": row.get("long"),
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
