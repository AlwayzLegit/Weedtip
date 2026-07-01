#!/usr/bin/env python3
"""Fetch active NY cannabis retail licenses from the state's official open-data feed.

Source: NY Office of Cannabis Management, "Current OCM Licenses" dataset on the
NY open-data portal (Socrata), https://data.ny.gov/resource/jskf-tt3q.json —
public record, no key required, updated regularly by the state.

Filters to licenses that are actually open storefronts (license_status=Active
AND operational_status=Active) among retail-relevant license types (Adult-Use
Retail Dispensary, Adult-Use Conditional Retail Dispensary, Adult-Use
Microbusiness — the same "retail"/"microbusiness" substrings the importer
already filters on). Writes a CSV using the importer's canonical column names
(no coordinates — geocode with geocode-ca-licenses.py before importing).

Usage: python scripts/fetch-ny-licenses.py <out.csv>
"""
import csv
import sys

import requests

SOCRATA = "https://data.ny.gov/resource/jskf-tt3q.json"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ny-licenses.csv"
    where = (
        "license_status='Active' and operational_status='Active' and "
        "(contains(license_type, 'Retail') or contains(license_type, 'Microbusiness'))"
    )
    rows, offset, page_size = [], 0, 1000
    while True:
        r = requests.get(
            SOCRATA,
            params={"$where": where, "$limit": page_size, "$offset": offset},
            timeout=60,
        )
        r.raise_for_status()
        batch = r.json()
        rows += batch
        offset += len(batch)
        if len(batch) < page_size:
            break
    print(f"fetched {len(rows)} active NY retail/microbusiness licenses", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({
                "business_dba_name": r.get("dba") or r.get("entity_name", ""),
                "business_legal_name": r.get("entity_name", ""),
                "license_number": r.get("license_number", ""),
                "license_status": r.get("license_status", ""),
                "license_type": r.get("license_type", ""),
                # Every row in this feed is an adult-use OCM license.
                "license_designation": "Adult-Use",
                "premise_street_address": r.get("address_line_1", ""),
                "premise_city": r.get("city", ""),
                "premise_state": "NY",
                "premise_zip_code": r.get("zip_code", ""),
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
