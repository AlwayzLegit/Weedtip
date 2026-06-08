#!/usr/bin/env python3
"""Enrich dispensary opening hours from OpenStreetMap (ODbL).

Parses OSM `opening_hours` tags for matched cannabis POIs into our hours jsonb
({mon:{open,close}|null, …, sun:…}, 24h "HH:mm") and emits UPDATEs, only where
hours is currently null (never overwrites owner-set hours). Same conservative
match as enrich-from-osm.py: a distinctive shared name token within 150m.

Attribution: data © OpenStreetMap contributors, ODbL.

Usage: python scripts/enrich-hours-from-osm.py <out.sql> <supabase_url> <anon_key>
"""
import json
import math
import re
import sys
import time

import requests

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = {"User-Agent": "weedtip-enrichment/1.0 (OSM ODbL)"}
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
OSM_DAY = {"mo": "mon", "tu": "tue", "we": "wed", "th": "thu", "fr": "fri", "sa": "sat", "su": "sun"}


def clamp_time(t):
    """Normalize 'H:MM'/'HH:MM' to 'HH:MM' (24h); 24:00 -> 23:59. None if invalid."""
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", t.strip())
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h == 24 and mi == 0:
        h, mi = 23, 59
    if not (0 <= h <= 23 and 0 <= mi <= 59):
        return None
    return f"{h:02d}:{mi:02d}"


def expand_days(tok):
    """'Mo-Fr' / 'Sa' / 'Mo,We' -> list of our day keys; [] if unparseable."""
    out = []
    for part in tok.split(","):
        part = part.strip().lower()
        if "-" in part:
            a, b = part.split("-", 1)
            a, b = OSM_DAY.get(a[:2]), OSM_DAY.get(b[:2])
            if a is None or b is None:
                return []
            i, j = DAYS.index(a), DAYS.index(b)
            out += DAYS[i : j + 1] if i <= j else DAYS[i:] + DAYS[: j + 1]
        else:
            d = OSM_DAY.get(part[:2])
            if d is None:
                return []
            out.append(d)
    return out


def parse_opening_hours(s):
    """Best-effort OSM opening_hours -> {day: {open,close}|None}. None if nothing usable."""
    if not s:
        return None
    s = re.sub(r'"[^"]*"', "", s)  # strip comments
    s = s.strip()
    hours = {d: None for d in DAYS}
    got = False
    if s.replace(" ", "") == "24/7":
        return {d: {"open": "00:00", "close": "23:59"} for d in DAYS}
    for rule in s.split(";"):
        rule = rule.strip()
        if not rule:
            continue
        m = re.match(r"^((?:[A-Za-z]{2}(?:-[A-Za-z]{2})?)(?:,[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+(.+)$", rule)
        if not m:
            continue
        days = expand_days(m.group(1))
        spec = m.group(2).strip().lower()
        if not days:
            continue
        if spec in ("off", "closed"):
            for d in days:
                hours[d] = None
            got = True
            continue
        # one or more "HH:MM-HH:MM" ranges; take earliest open, latest close
        ranges = re.findall(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", spec)
        if not ranges:
            continue
        opens = [clamp_time(a) for a, _ in ranges]
        closes = [clamp_time(b) for _, b in ranges]
        opens = [t for t in opens if t]
        closes = [t for t in closes if t]
        if not opens or not closes:
            continue
        o, c = min(opens), max(closes)
        # Drop implausibly short windows (likely bad OSM data, e.g. 09:00-09:30).
        om, cm = (int(o[:2]) * 60 + int(o[3:])), (int(c[:2]) * 60 + int(c[3:]))
        if cm - om < 60:
            continue
        for d in days:
            hours[d] = {"open": o, "close": c}
        got = True
    return hours if got else None


def norm_name(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    stop = {"the", "inc", "llc", "co", "corp", "cannabis", "dispensary", "weed", "shop",
            "collective", "wellness", "center", "centre", "group", "healing", "holistic",
            "care", "supply", "club", "organics", "organic", "gardens", "garden", "health",
            "company", "store", "retail", "delivery", "and", "of", "la", "ca"}
    return {w for w in s.split() if w and w not in stop and len(w) > 1}


def haversine_m(a, b, c, d):
    R = 6371000
    p1, p2 = math.radians(a), math.radians(c)
    x = math.sin(math.radians(c - a) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(d - b) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def fetch_osm():
    q = """
    [out:json][timeout:120];
    area['ISO3166-2'='US-CA'][admin_level=4]->.ca;
    (nwr['shop'='cannabis'](area.ca); nwr['shop'='weed'](area.ca); nwr['dispensing'='cannabis'](area.ca););
    out tags center;
    """
    els = None
    for attempt in range(6):
        try:
            r = requests.post(OVERPASS_MIRRORS[attempt % len(OVERPASS_MIRRORS)],
                              data={"data": q}, headers=UA, timeout=180)
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
        if lat is None or lon is None or not t.get("opening_hours"):
            continue
        out.append({"name": t.get("name", ""), "oh": t["opening_hours"], "lat": lat, "lon": lon})
    return out


def fetch_dispensaries(url, key):
    rows, offset = [], 0
    while True:
        b = requests.get(f"{url}/rest/v1/dispensaries",
                         headers={"apikey": key, "Authorization": f"Bearer {key}"},
                         params={"select": "slug,name,latitude,longitude,hours",
                                 "latitude": "not.is.null", "hours": "is.null",
                                 "limit": 1000, "offset": offset}, timeout=120).json()
        if not b:
            break
        rows += b
        offset += len(b)
        if len(b) < 1000:
            break
    return rows


def main():
    out, url, key = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
    osm = fetch_osm()
    disp = fetch_dispensaries(url, key)
    print(f"OSM POIs w/ opening_hours: {len(osm)} | dispensaries w/o hours: {len(disp)}")
    updates = {}
    for d in disp:
        dl, dn = float(d["latitude"]), float(d["longitude"])
        dtok = norm_name(d["name"])
        best, bestdist = None, 1e9
        for o in osm:
            dist = haversine_m(dl, dn, o["lat"], o["lon"])
            if dist < bestdist:
                bestdist, best = dist, o
        if not best or not (dtok & norm_name(best["name"])) or bestdist > 150:
            continue
        parsed = parse_opening_hours(best["oh"])
        if parsed:
            updates[d["slug"]] = json.dumps(parsed)
    lines = [
        "-- Enrich dispensary opening hours from OpenStreetMap (ODbL).",
        "-- Parsed from OSM opening_hours on name+proximity matched POIs; only where hours was null.",
        "-- Data (c) OpenStreetMap contributors.",
        f"-- Dispensaries with hours added: {len(updates)}",
        "",
    ]
    for slug in sorted(updates):
        j = updates[slug].replace("'", "''")
        lines.append(f"update public.dispensaries set hours = '{j}'::jsonb where slug = '{slug}' and hours is null;")
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"wrote {out}: {len(updates)} dispensaries with hours")


if __name__ == "__main__":
    main()
