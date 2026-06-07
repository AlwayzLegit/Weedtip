#!/usr/bin/env python3
"""Backfill dispensaries.legal_name from the DCC registered business name.

Pulls the live DCC registry and emits an UPDATE per dispensary (matched by
license_number) setting legal_name to the registered business_legal_name.
Run after 20260607230000_dcc_relabel (which adds the column).

Usage: python scripts/gen-legal-names.py <out.sql> <supabase_url> <anon_key>
"""
import re
import sys
import time

import requests

DCC = "https://as-dcc-pub-cann-w-p-002.azurewebsites.net"
H = {"User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "application/json",
     "Origin": "https://search.cannabis.ca.gov", "Referer": "https://search.cannabis.ca.gov/"}
NULLISH = {"", "data not available", "not published", "n/a", "na", "none", "null"}


def clean(v):
    s = str(v or "").strip()
    return None if s.lower() in NULLISH else s


def title_case(v):
    if not v:
        return v
    v = re.sub(r"\b([a-z])", lambda m: m.group(1).upper(), v.lower())
    return re.sub(r"\b(Llc|Inc|Co|Dba)\b", lambda m: m.group(1).upper(), v)


def sql(v):
    return "null" if not v else "'" + v.replace("'", "''") + "'"


def fetch_our_licenses(url, key):
    lics, offset = set(), 0
    while True:
        r = requests.get(f"{url}/rest/v1/dispensaries",
                         headers={"apikey": key, "Authorization": f"Bearer {key}"},
                         params={"select": "license_number", "license_number": "not.is.null",
                                 "limit": 1000, "offset": offset}, timeout=120)
        b = r.json()
        if not b:
            break
        lics.update(x["license_number"] for x in b)
        offset += len(b)
        if len(b) < 1000:
            break
    return lics


def main():
    out, url, key = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
    ours = fetch_our_licenses(url, key)
    print("our licensed dispensaries:", len(ours))
    rows, page = [], 1
    while True:
        b = requests.get(DCC + "/licenses/filteredSearch", headers=H,
                         params={"pageSize": 1000, "pageNumber": page, "searchQuery": ""}, timeout=120).json()
        rows += b["data"]
        if not b["metadata"]["hasNext"]:
            break
        page += 1
        time.sleep(0.1)
    by_lic = {}
    for r in rows:
        lic = clean(r.get("licenseNumber"))
        legal = title_case(clean(r.get("businessLegalName")))
        if lic and legal and lic in ours:
            by_lic[lic] = legal
    lines = [
        "-- Backfill dispensaries.legal_name from the DCC registered business name (by license).",
        f"-- Source rows: {len(by_lic)}",
        "",
    ]
    for lic in sorted(by_lic):
        lines.append(
            f"update public.dispensaries set legal_name = {sql(by_lic[lic])} "
            f"where license_number = {sql(lic)} and legal_name is null;"
        )
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"wrote {out}: {len(by_lic)} legal-name updates")


if __name__ == "__main__":
    main()
