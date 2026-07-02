#!/usr/bin/env python3
"""Fetch licensed MI adult-use cannabis retailers.

Source: the Cannabis Regulatory Agency's public license search
(aca-prod.accela.com/MIMM, License Type = "Marihuana Retailer - License")
is a stateful Accela Citizen Access portal with no public REST API and a
native-<select> dropdown whose values aren't derivable without rendering
the page. The search was driven in a real browser (Chrome, via the
claude-in-chrome MCP): filtered to License Type = Marihuana Retailer -
License via form_input, then paginated through the results grid (10
rows/page) reading the accessibility tree. The portal returns the full
historical ledger of every retailer license ever issued -- it kept
growing past 700 records as older, mostly-revoked ("License Void") pages
were reached -- so extraction was capped at the 400 most-recently-issued
records (record numbers AU-R-001076 through AU-R-001573), which skews
heavily toward currently active stores (355 Active / 45 License Void in
this slice). This data is bundled as scripts/data/mi-dispensaries-raw.csv
since it's a one-time browser extraction, not a re-runnable API call.

Only Active-status records are imported; License Void rows are dropped
here. No coordinates published; run scripts/geocode-ca-licenses.py
afterward. Addresses arrive as a single "street, city MI zip" string and
are split with a regex.

Re-run note: to refresh or extend coverage further back, re-open the
search URL above in a browser (License Type = Marihuana Retailer -
License) and re-extract additional pages.

Usage: python scripts/fetch-mi-licenses.py <out.csv>
"""
import csv
import os
import re
import sys

RAW_CSV = os.path.join(os.path.dirname(__file__), "data", "mi-dispensaries-raw.csv")

FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]

ADDRESS_RE = re.compile(r"^(?P<street>.+),\s*(?P<city>[^,]+?)\s+MI\s+(?P<zip>\d{5})$")


def parse_address(address):
    m = ADDRESS_RE.match(address.strip())
    if not m:
        return address.strip(), "", ""
    return m.group("street").strip(), m.group("city").strip(), m.group("zip").strip()


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "mi-licenses.csv"
    with open(RAW_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    active = [r for r in rows if r["status"] == "Active"]

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in active:
            street, city, zip_code = parse_address(row["address"])
            w.writerow({
                "business_dba_name": row["name"],
                "business_legal_name": row["name"],
                "license_number": row["record_number"],
                "license_status": "Active",
                "license_type": "Retail (Adult-Use Retailer)",
                "license_designation": "Adult-Use",
                "premise_street_address": street,
                "premise_city": city,
                "premise_state": "MI",
                "premise_zip_code": zip_code,
                "business_phone": "",
                "business_website": "",
                "business_email": "",
                "premise_latitude": "",
                "premise_longitude": "",
            })
    print(f"wrote {len(active)} of {len(rows)} MI dispensaries to {out} "
          f"({len(rows) - len(active)} License Void skipped)", flush=True)


if __name__ == "__main__":
    main()
