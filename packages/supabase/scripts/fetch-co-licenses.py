#!/usr/bin/env python3
"""Fetch licensed CO cannabis retail (stores + delivery) from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the Colorado
Marijuana Enforcement Division licensee list. NOTE: this snapshot is dated
2023-09-01 (Cannlytics' latest for CO) -- CO's own open-data listing
(data.colorado.gov) is a Tableau-dashboard pointer, not a queryable API, and
its regulator site (sbg.colorado.gov) blocks scripted access, so this is the
best available public-record source at import time. Treat as a base layer;
re-run Google enrichment periodically to refresh phone/website/hours.

The raw file has no license_status column (all listed licenses are treated as
active) and stores the address in a "Street" column instead of
premise_street_address. "Stores" and "Delivery" are the retail-relevant
license_type values; both are normalized to include "Retail" since neither
contains that substring on its own (same class of issue as CT).

Usage: python scripts/fetch-co-licenses.py <out.csv>
"""
import csv
import io
import re
import sys

import requests

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/co/licenses-co-latest.csv"
RETAIL_TYPES = {"Stores", "Delivery"}
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def title_case(v):
    v = re.sub(r"\b([a-z])", lambda m: m.group(1).upper(), (v or "").lower())
    return re.sub(r"\b(Llc|Inc|Co|Dba)\b", lambda m: m.group(1).upper(), v)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "co-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [row for row in rows if (row.get("license_type") or "").strip() in RETAIL_TYPES]
    print(f"fetched {len(rows)} CO licenses; {len(retail)} are retail (stores/delivery)", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            lic = (r_.get("license_number") or "").strip()
            if not lic:
                continue
            w.writerow({
                "business_dba_name": title_case(r_.get("business_dba_name") or r_.get("business_legal_name")),
                "business_legal_name": title_case(r_.get("business_legal_name")),
                "license_number": lic,
                "license_status": "Active",
                "license_type": f"Retail ({r_.get('license_type', '')})",
                "license_designation": r_.get("license_designation") or "",
                "premise_street_address": r_.get("Street") or "",
                "premise_city": r_.get("premise_city") or "",
                "premise_state": "CO",
                "premise_zip_code": r_.get("premise_zip_code") or "",
                "business_phone": r_.get("business_phone") or "",
                "business_website": r_.get("business_website") or "",
                "business_email": r_.get("business_email") or "",
                "premise_latitude": r_.get("premise_latitude") or "",
                "premise_longitude": r_.get("premise_longitude") or "",
            })
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
