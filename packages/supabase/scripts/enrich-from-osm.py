#!/usr/bin/env python3
"""Enrich dispensaries with public phone/website from OpenStreetMap.

OSM is open data (ODbL) and freely storable with attribution — unlike Google/
Yelp. This matches our mapped dispensaries to OSM cannabis POIs by proximity
(+ name check) and emits UPDATEs filling the PUBLIC phone/website (set null by
the DCC relabel) where OSM has them. Conservative matching avoids wrong joins.

Attribution: data © OpenStreetMap contributors, ODbL.

Usage: python scripts/enrich-from-osm.py <out.sql> <supabase_url> <anon_key>
"""
import math
import re
import sys

import requests

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = {"User-Agent": "weedtip-enrichment/1.0 (OSM ODbL)"}


def norm_name(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    # Drop generic words so overlap reflects the distinctive brand, not "wellness".
    stop = {
        "the", "inc", "llc", "co", "corp", "cannabis", "dispensary", "weed", "shop",
        "collective", "wellness", "center", "centre", "group", "healing", "holistic",
        "care", "supply", "club", "organics", "organic", "gardens", "garden", "health",
        "company", "store", "retail", "delivery", "and", "of", "la", "ca",
    }
    return {w for w in s.split() if w and w not in stop and len(w) > 1}


def haversine_m(a, b, c, d):
    R = 6371000
    p1, p2 = math.radians(a), math.radians(c)
    dp = math.radians(c - a)
    dl = math.radians(d - b)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def fetch_osm():
    q = """
    [out:json][timeout:120];
    area['ISO3166-2'='US-CA'][admin_level=4]->.ca;
    (nwr['shop'='cannabis'](area.ca); nwr['shop'='weed'](area.ca); nwr['dispensing'='cannabis'](area.ca););
    out tags center;
    """
    import time
    els = None
    for attempt in range(6):
        url = OVERPASS_MIRRORS[attempt % len(OVERPASS_MIRRORS)]
        try:
            r = requests.post(url, data={"data": q}, headers=UA, timeout=180)
            if r.status_code == 200 and r.text.strip().startswith("{"):
                els = r.json()["elements"]
                break
        except Exception:
            pass
        time.sleep(5)
    if els is None:
        raise SystemExit("Overpass unavailable after retries; try again shortly.")
    out = []
    for e in els:
        t = e.get("tags", {})
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        phone = t.get("phone") or t.get("contact:phone")
        web = t.get("website") or t.get("contact:website")
        if not phone and not web:
            continue
        out.append({"name": t.get("name", ""), "phone": phone, "web": web, "lat": lat, "lon": lon})
    return out


def fetch_dispensaries(url, key):
    rows, offset = [], 0
    while True:
        r = requests.get(f"{url}/rest/v1/dispensaries",
                         headers={"apikey": key, "Authorization": f"Bearer {key}"},
                         params={"select": "slug,name,latitude,longitude,website",
                                 "latitude": "not.is.null", "limit": 1000, "offset": offset}, timeout=120)
        b = r.json()
        if not b:
            break
        rows += b
        offset += len(b)
        if len(b) < 1000:
            break
    return rows


def sql(v):
    return "null" if not v else "'" + str(v).replace("'", "''") + "'"


def main():
    out, url, key = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
    osm = fetch_osm()
    disp = fetch_dispensaries(url, key)
    print(f"OSM POIs w/ contact: {len(osm)} | mapped dispensaries: {len(disp)}")
    updates = {}
    for d in disp:
        dl, dn = float(d["latitude"]), float(d["longitude"])
        dtok = norm_name(d["name"])
        best, bestdist = None, 1e9
        for o in osm:
            dist = haversine_m(dl, dn, o["lat"], o["lon"])
            if dist < bestdist:
                bestdist, best = dist, o
        if not best:
            continue
        overlap = len(dtok & norm_name(best["name"])) > 0
        # Require a distinctive shared name token AND proximity. Proximity alone
        # mismatches in dense areas (and our coords can be approximate), and a
        # wrong phone/website is worse than none — so precision over recall.
        if overlap and bestdist <= 150:
            phone = best["phone"]
            web = best["web"] if not d.get("website") else None
            sets = []
            if phone:
                sets.append(f"phone = {sql(phone)}")
            if web:
                sets.append(f"website = {sql(web)}")
            if sets:
                updates[d["slug"]] = sets
    lines = [
        "-- Enrich dispensaries with public phone/website from OpenStreetMap (ODbL).",
        "-- Matched to OSM cannabis POIs requiring a distinctive shared name token within 150m.",
        "-- Data (c) OpenStreetMap contributors.",
        f"-- Dispensaries enriched: {len(updates)}",
        "",
    ]
    for slug in sorted(updates):
        lines.append(f"update public.dispensaries set {', '.join(updates[slug])} where slug = {sql(slug)};")
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"wrote {out}: {len(updates)} dispensaries enriched")


if __name__ == "__main__":
    main()
