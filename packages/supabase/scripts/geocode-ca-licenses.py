#!/usr/bin/env python3
"""Fill missing premise coordinates in a DCC license CSV via the US Census geocoder.

The `dispensaries.location` column is NOT NULL, so rows without coordinates are
dropped by the importer. Many DCC retail/microbusiness rows ship without
lat/long; this fills them by geocoding the published street address using the
free US Census batch geocoder (no API key). Rows whose address DCC suppresses
("Data Not Available" / "Not Published") cannot be geocoded and stay coordinate-less
(e.g. most delivery-only / non-storefront retailers).

Usage:
    python scripts/geocode-ca-licenses.py licenses-ca-live.csv licenses-ca-live-geo.csv
"""
import csv
import io
import re
import sys

import pandas as pd
import requests

NULLISH = {"", "data not available", "not published", "n/a", "na", "none", "null", "tbd"}
CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"


def real(v: str) -> str:
    s = str(v).strip()
    return s if s.lower() not in NULLISH else ""


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "licenses-ca-live.csv"
    dst = sys.argv[2] if len(sys.argv) > 2 else "licenses-ca-live-geo.csv"
    df = pd.read_csv(src, dtype=str, low_memory=False)
    lat = pd.to_numeric(df["premise_latitude"], errors="coerce")
    lng = pd.to_numeric(df["premise_longitude"], errors="coerce")
    has_coord = lat.between(32, 42) & lng.between(-125, -114)
    s = df["license_status"].fillna("").str.lower()
    t = df["license_type"].fillna("").str.lower()
    target = s.str.contains("active") & (t.str.contains("retail") | t.str.contains("microbusiness"))
    need = df[target & ~has_coord]

    def geocodable(r):
        return bool(real(r["premise_street_address"])) and bool(real(r["premise_city"])) and bool(
            re.search(r"\d{5}", str(r["premise_zip_code"]))
        )

    geo = need[need.apply(geocodable, axis=1)]
    print(f"missing coords: {len(need)} | geocodable: {len(geo)} | unmappable: {len(need) - len(geo)}", flush=True)

    coords = {}
    rows = list(geo.iterrows())
    for start in range(0, len(rows), 4000):  # Census batch cap is 10k; stay well under
        chunk = rows[start : start + 4000]
        buf = io.StringIO()
        w = csv.writer(buf)
        for i, r in chunk:
            z = re.search(r"\d{5}", str(r["premise_zip_code"])).group(0)
            w.writerow([i, real(r["premise_street_address"]), real(r["premise_city"]), "CA", z])
        resp = requests.post(
            CENSUS,
            files={"addressFile": ("a.csv", buf.getvalue(), "text/csv")},
            data={"benchmark": "Public_AR_Current"},
            timeout=600,
        )
        m = 0
        for row in csv.reader(io.StringIO(resp.text)):
            if len(row) >= 6 and row[2] == "Match":
                try:
                    lo, la = row[5].split(",")
                    coords[int(row[0])] = (float(la), float(lo))
                    m += 1
                except Exception:
                    pass
        print(f"  chunk {start // 4000 + 1}: matched {m}/{len(chunk)}", flush=True)

    for idx, (la, lo) in coords.items():
        df.at[idx, "premise_latitude"] = la
        df.at[idx, "premise_longitude"] = lo
    df.to_csv(dst, index=False)
    print(f"matched {len(coords)} total; wrote {dst}", flush=True)


if __name__ == "__main__":
    main()
