#!/usr/bin/env python3
"""Generate a seed migration for delivery-only (non-storefront) CA retailers.

These DCC licenses have no public premise address or coordinates — only a
service-area county — so they're stored as location-less listings
(is_delivery=true, location/address/city/zip NULL, county set). Requires the
20260607200000_dispensary_delivery_only migration (nullable premise + county).

Pulls the current DCC registry, reserves existing dispensary slugs (fetched via
the public REST API so generated slugs never collide), and writes an idempotent
insert migration. Usage:

    python scripts/gen-delivery-only.py <out.sql> <supabase_url> <anon_key>
"""
import re
import sys

import requests

DCC = "https://as-dcc-pub-cann-w-p-002.azurewebsites.net"
H = {"User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "application/json",
     "Origin": "https://search.cannabis.ca.gov", "Referer": "https://search.cannabis.ca.gov/"}
NULLISH = {"", "data not available", "not published", "n/a", "na", "none", "null", "tbd"}


def clean(v):
    s = str(v or "").strip()
    return None if s.lower() in NULLISH else s


def title_case(v):
    if not v:
        return v
    v = re.sub(r"\b([a-z])", lambda m: m.group(1).upper(), v.lower())
    v = re.sub(r"\b(Llc|Inc|Co|Dba)\b", lambda m: m.group(1).upper(), v)
    return v


def slugify(v):
    v = v.lower().replace("&", " and ")
    v = re.sub(r"[^a-z0-9]+", "-", v).strip("-")[:60].rstrip("-")
    return v


def fetch_dcc():
    rows, page = [], 1
    while True:
        b = requests.get(DCC + "/licenses/filteredSearch", headers=H,
                         params={"pageSize": 1000, "pageNumber": page, "searchQuery": ""}, timeout=120).json()
        rows += b["data"]
        if not b["metadata"]["hasNext"]:
            break
        page += 1
    return rows


def fetch_existing_slugs(url, key):
    slugs, offset = set(), 0
    while True:
        r = requests.get(f"{url}/rest/v1/dispensaries", headers={"apikey": key, "Authorization": f"Bearer {key}"},
                         params={"select": "slug", "limit": 1000, "offset": offset}, timeout=120)
        batch = r.json()
        if not batch:
            break
        slugs.update(x["slug"] for x in batch)
        offset += len(batch)
        if len(batch) < 1000:
            break
    return slugs


def sql_str(v):
    return "null" if v is None or v == "" else "'" + str(v).replace("'", "''") + "'"


def main():
    out = sys.argv[1]
    url = sys.argv[2].rstrip("/")
    key = sys.argv[3]
    reserved = fetch_existing_slugs(url, key)
    print("reserved existing slugs:", len(reserved))
    rows = fetch_dcc()
    seen_slug = set(reserved)
    seen_lic = set()
    out_rows, dropped = [], 0
    for r in rows:
        status = (clean(r.get("licenseStatus")) or "").lower()
        ltype = (clean(r.get("licenseType")) or "").lower()
        if "active" not in status:
            continue
        if not ("retail" in ltype and ("nonstorefront" in ltype or "non-storefront" in ltype)):
            continue
        name = title_case(clean(r.get("businessDbaName")) or clean(r.get("businessLegalName")) or "")
        legal = title_case(clean(r.get("businessLegalName")) or "")
        if name and (len(name) < 2 or len(name) > 120) and legal and 2 <= len(legal) <= 120:
            name = legal
        if not name or len(name) < 2:
            dropped += 1
            continue
        if len(name) > 120:
            name = name[:120].strip()
        lic = clean(r.get("licenseNumber"))
        if lic and lic in seen_lic:
            continue
        if lic:
            seen_lic.add(lic)
        slug = slugify(name) or slugify(lic or "delivery")
        if slug in seen_slug:
            county_part = slugify(clean(r.get("premiseCounty")) or "")
            cand = f"{slug}-{county_part}" if county_part else slug
            n = 2
            while cand in seen_slug:
                cand = f"{slug}-{n}"
                n += 1
            slug = cand
        seen_slug.add(slug)
        desig = (clean(r.get("licenseDesignation")) or "").lower()
        is_med = "true" if (re.search("medic", desig) if desig else True) else "false"
        is_rec = "true" if (re.search("adult", desig) if desig else True) else "false"
        county = title_case(clean(r.get("premiseCounty")))
        phone = clean(r.get("businessPhone"))
        email = clean(r.get("businessEmail"))
        email = email.lower() if email and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email) else None
        out_rows.append(
            f"  ({sql_str(name)}, {sql_str(slug)}, {sql_str(county)}, {sql_str(phone)}, "
            f"{sql_str(email)}, {sql_str(lic)}, {is_med}, {is_rec}, true, false, 'CA', 'active')"
        )
    banner = (
        "-- Seed: active CA delivery-only (non-storefront) retailers as location-less listings.\n"
        "-- DCC publishes no premise address/coordinates for these — only the service-area\n"
        "-- county — so location/address/city/zip are NULL and county is set. Public-record data.\n"
        f"-- Records: {len(out_rows)} (dropped {dropped} with no usable name)\n\n"
    )
    sql = (banner + "insert into public.dispensaries\n"
           "  (name, slug, county, phone, email, license_number, is_medical, is_recreational, is_delivery, is_pickup, state, status)\nvalues\n"
           + ",\n".join(out_rows) + "\non conflict (slug) do nothing;\n")
    open(out, "w", encoding="utf-8").write(sql)
    print(f"wrote {out}: {len(out_rows)} delivery-only rows")


if __name__ == "__main__":
    main()
