#!/usr/bin/env python3
"""Fetch OK dispensaries via Weedmaps' public discovery API.

Source: Oklahoma's official regulator tool (OMMA Verify,
medportal.omma.ok.gov) publishes license number/status/type/expiration
but NO address, city, or ZIP anywhere (confirmed by inspecting both the
list view and the per-license "View" detail modal) -- a genuine
data-completeness gap in the source, not an access problem. Its
"Download (.csv)" button is also unreliable (produces a deterministically
truncated ~21-row file, not a real bulk export). Per user decision, this
falls back to a third-party directory (Weedmaps) rather than leaving OK
uncovered, at the cost of lower trust/staleness than a primary-regulator
source and only spot-check (not exhaustive) cross-referencing against
OMMA's Active list, since OMMA has no bulk-active export either.

Weedmaps has no official public API docs, but its site is a Next.js app
whose __NEXT_DATA__ / React-Query dehydrated cache reveals the first-party
endpoint it calls client-side: a keyless, working REST endpoint at
https://api-g.weedmaps.com/discovery/v2/listings, queried with
filter[bounding_latlng], filter[bounding_radius]=500mi,
filter[plural_types][]=dispensaries, and page_size (max 150). Plain
`requests.get()` gets bot-blocked (406); this was originally fetched via
a real authenticated browser session's in-page fetch() (9 paginated
calls covering a 500mi radius from central OK), filtered client-side to
state == "Oklahoma" (577 raw records, 575 after deduping 2 exact-duplicate
listing ids that Weedmaps' own pagination returned twice), then
transferred out of the browser and bundled as
scripts/data/ok-dispensaries-raw.csv since re-running requires repeating
that browser-session fetch, not a stable script-only API call.

Weedmaps' listings already include lat/lon and a full street address, so
unlike scripts/fetch-sd-licenses.py or scripts/fetch-ms-licenses.py, no
separate geocoding step is needed here. license_number is synthesized as
OK-WM-<weedmaps id> since Weedmaps listings aren't keyed to an OMMA
license number.

Re-run note: to refresh, re-run the __NEXT_DATA__ / React-Query cache
inspection technique against https://weedmaps.com/dispensaries/in/united-
states/oklahoma in a real browser session to rediscover the endpoint
shape (it may change), then re-paginate filter[plural_types][]=dispensaries
at page_size=150 and re-filter to state == "Oklahoma".

Usage: python scripts/fetch-ok-licenses.py <out.csv>
"""
import csv
import os
import sys

RAW_CSV = os.path.join(os.path.dirname(__file__), "data", "ok-dispensaries-raw.csv")
FIELDS = [
    "business_dba_name", "business_legal_name", "license_number", "license_status",
    "license_type", "license_designation", "premise_street_address", "premise_city",
    "premise_state", "premise_zip_code", "business_phone", "business_website",
    "business_email", "premise_latitude", "premise_longitude",
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "ok-licenses.csv"
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
                "license_number": f"OK-WM-{row['id']}",
                "license_status": "Active" if row["is_published"] == "true" else "Unpublished",
                "license_type": "Retail (Dispensary)",
                "license_designation": designation_map.get(row["license_type"], "Adult-Use/Medicinal"),
                "premise_street_address": row["address"],
                "premise_city": row["city"],
                "premise_state": "OK",
                "premise_zip_code": row["zip"],
                "business_phone": row["phone"],
                "business_website": "",
                "business_email": row["email"],
                "premise_latitude": row["lat"],
                "premise_longitude": row["lon"],
            })
    print(f"wrote {len(rows)} OK dispensaries to {out}", flush=True)


if __name__ == "__main__":
    main()
