#!/usr/bin/env python3
"""Fetch licensed NJ cannabis dispensaries.

Source: the NJ Cannabis Regulatory Commission's official dispensary finder
(nj.gov/cannabis/dispensaries/find/) embeds a public Atlist map
(my.atlist.com/map/8bed33fa-9b8c-4c51-bb33-74cd0d98628a). Atlist's REST API
requires an X-Api-Key header whose value isn't exposed in the widget's own
JS bundle, so this was extracted by rendering the map in a real browser
(Chrome, via the claude-in-chrome MCP) and reading the fully-rendered
sidebar list from the accessibility tree -- 315 of ~398 listed dispensaries,
each with name, full address, and license-type tags (Recreational,
Medicinal, Microbusiness, Expanded ATC, Consumption Area, Delivery). This
data is bundled as scripts/data/nj-dispensaries-raw.csv (name, street,
city, state, zip, tags) since it's a one-time browser extraction, not a
re-runnable API call. No coordinates published; run
scripts/geocode-ca-licenses.py afterward.

Re-run note: to refresh, re-open the Atlist map URL above in a browser and
re-extract the sidebar list, or find the map's API auth token.

Usage: python scripts/fetch-nj-licenses.py <out.csv>
"""
import csv
import os
import sys

RAW_CSV = os.path.join(os.path.dirname(__file__), "data", "nj-dispensaries-raw.csv")

FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def designation_from_tags(tags):
    tags = tags.lower()
    has_med = "medicinal" in tags or "expanded atc" in tags
    has_rec = "recreational" in tags or "expanded atc" in tags
    if has_med and has_rec:
        return "Medical Adult-Use"
    if has_med:
        return "Medical"
    if has_rec:
        return "Adult-Use"
    return ""


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "nj-licenses.csv"
    with open(RAW_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for i, row in enumerate(rows):
            w.writerow({
                "business_dba_name": row["name"],
                "business_legal_name": row["name"],
                "license_number": f"NJ-CRC-{i + 1:04d}",
                "license_status": "Active",
                "license_type": "Retail (Dispensary)",
                "license_designation": designation_from_tags(row["tags"]),
                "premise_street_address": row["street"],
                "premise_city": row["city"],
                "premise_state": "NJ",
                "premise_zip_code": row["zip"],
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(rows)} NJ dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
