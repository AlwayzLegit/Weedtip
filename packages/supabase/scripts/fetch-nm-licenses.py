#!/usr/bin/env python3
"""Fetch NM dispensaries via Weedmaps (replaces a broken Cannlytics/CCD source).

The original NM import (this script's prior version, since replaced) pulled
from a Cannlytics mirror of the NM Cannabis Control Division licensee list and
claimed "full address and coordinates already present" -- but every one of the
272 records it produced actually shared the exact same address and lat/lon
("3400 Vassar Dr NE, Albuquerque"), and included non-retail entities
(cultivators, a grow-supply shop, at least one individual's name) that slipped
through the license_type == "Cannabis Retailer" filter. This wasn't a bug
introduced downstream -- the source CSV itself was defective (likely every row
defaulting to a shared registered-agent/office address). All 272 of those rows
were deleted and replaced by this script's output.

Source: Weedmaps' public discovery API (same reverse-engineered endpoint used
for scripts/fetch-ok-licenses.py -- see that script's docstring for how it was
discovered), queried from Albuquerque with a 500mi radius and filtered
client-side to state == "New Mexico": 294 real, distinct dispensaries (294
distinct addresses and coordinates, unlike the broken source). This data is
bundled as scripts/data/nm-dispensaries-raw.csv since re-running requires
repeating the browser-session fetch, not a stable script-only API call.

Like scripts/fetch-ok-licenses.py, Weedmaps already provides lat/lon and a full
street address, so no separate geocoding step is needed.

Usage: python scripts/fetch-nm-licenses.py <out.csv>
"""
import csv
import os
import sys

RAW_CSV = os.path.join(os.path.dirname(__file__), "data", "nm-dispensaries-raw.csv")
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "nm-licenses.csv"
    with open(RAW_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    # import-la-dispensaries.mjs derives is_medical/is_recreational from this
    # column via /medic/ and /adult/ regexes -- "Hybrid"/"Recreational" (a plain
    # .capitalize() of Weedmaps' license_type) match neither, so both flags
    # would silently end up false. Map to strings the regexes actually catch.
    designation_map = {
        "medical": "Medical",
        "recreational": "Adult-Use",
        "hybrid": "Adult-Use/Medicinal",
    }

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in rows:
            w.writerow({
                "business_dba_name": row["name"],
                "business_legal_name": row["name"],
                "license_number": f"NM-WM-{row['id']}",
                "license_status": "Active" if row["is_published"] == "true" else "Unpublished",
                "license_type": "Retail (Dispensary)",
                "license_designation": designation_map.get(row["license_type"], "Adult-Use/Medicinal"),
                "premise_street_address": row["address"],
                "premise_city": row["city"],
                "premise_state": "NM",
                "premise_zip_code": row["zip"],
                "business_phone": row["phone"],
                "business_website": "",
                "business_email": row["email"],
                "premise_latitude": row["lat"],
                "premise_longitude": row["lon"],
            })
    print(f"wrote {len(rows)} NM dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
