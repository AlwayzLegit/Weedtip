#!/usr/bin/env python3
"""Fetch licensed WA cannabis retailers from the Cannlytics mirror.

Source: Cannlytics `cannabis_licenses` (CC-BY-4.0) mirror of the WA Liquor and
Cannabis Board (LCB) licensee list. NOTE: this snapshot is dated 2023-08-08 --
WA LCB does not publish a clean "all active cannabis retailers" CSV/API (its
Socrata "Cannabis Renewal" dataset is only a rolling renewal-cycle subset, and
its frequently-requested-lists page has no all-retailers file), so this is the
best available public-record source at import time.

Already in canonical column layout with coordinates included (no geocoding
needed); license_type values ("Adult-Use Retailer", "Medical Retailer") already
contain "retail" so no normalization is needed.

Usage: python scripts/fetch-wa-licenses.py <out.csv>
"""
import csv
import io
import sys

import requests

CANNLYTICS_URL = "https://huggingface.co/datasets/cannlytics/cannabis_licenses/resolve/main/data/wa/licenses-wa-latest.csv"
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "wa-licenses.csv"
    r = requests.get(CANNLYTICS_URL, timeout=60)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", errors="replace"))))
    retail = [row for row in rows if "Retailer" in (row.get("license_type") or "")]
    print(f"fetched {len(rows)} WA licenses; {len(retail)} are retailers", flush=True)

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r_ in retail:
            w.writerow({k: r_.get(k, "") for k in FIELDS})
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
