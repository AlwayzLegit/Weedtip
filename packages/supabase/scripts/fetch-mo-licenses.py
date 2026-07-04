#!/usr/bin/env python3
"""Fetch licensed MO cannabis dispensaries from the DCR's live ArcGIS feature
service.

Source: the Division of Cannabis Regulation's "DCR - Verified Dispensary
Locator App" (embedded on health.mo.gov/safety/cannabis/licensed-facilities.php
as an ArcGIS Experience) is backed by a public, unauthenticated FeatureServer
-- found by fetching the experience item's web-app config for its
operationalLayers URL, same technique used for OH/MD/GA. 238 records,
updated June 2026, full address + coordinates + phone + license number.
This supersedes the earlier attempt this session, which found a private
ArcGIS org item (403) and a corrupted, address-less Cannlytics mirror --
the live dashboard evidently moved to a new, public Experience item since
then.

Usage: python scripts/fetch-mo-licenses.py <out.csv>
"""
import csv
import sys

import requests

FEATURE_SERVER = (
    "https://services6.arcgis.com/Bd4MACzvEukoZ9mR/arcgis/rest/services/"
    "DCR_Verified_Dispensary_Map_layer/FeatureServer/0/query"
)
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "mo-licenses.csv"
    r = requests.get(FEATURE_SERVER, params={"where": "1=1", "outFields": "*", "f": "json"}, timeout=60)
    r.raise_for_status()
    features = [f["attributes"] for f in r.json().get("features", [])]
    print(f"fetched {len(features)} MO dispensaries", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in features:
            w.writerow({
                "business_dba_name": row.get("Dispensary", ""),
                "business_legal_name": row.get("Dispensary", ""),
                "license_number": row.get("License", ""),
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": "",
                "premise_street_address": (row.get("Address") or "").strip(),
                "premise_city": row.get("City", ""),
                "premise_state": "MO",
                "premise_zip_code": row.get("Zip_code", ""),
                "business_phone": row.get("Phone_Number", "") or "",
                "business_website": row.get("Website", "") or "",
                "business_email": "",
                "premise_latitude": row.get("latitude"),
                "premise_longitude": row.get("longitude"),
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
