#!/usr/bin/env python3
"""Enrich dispensaries with public phone/website/hours from the Google Places API.

OFFICIAL API (not scraping). For each mapped dispensary it runs a Places API
(New) Text Search biased to the shop's coordinates, verifies the result by
proximity (<=150m) + a shared name token, then writes the public phone/website/
hours (only where ours is null) plus the stable google_place_id.

Compliance: storing place_id is permitted; other Place content is treated as a
cache and refreshed when this is re-run (e.g. monthly). Photos/reviews are NOT
stored here (Google restricts that) — fetch those live if needed.

Cost: Text Search (New) with these fields is ~$0.03–0.04 per dispensary.
Use --limit to test cheaply first.

Env:  GOOGLE_PLACES_API_KEY
Usage: python scripts/enrich-from-google.py <out.sql> <supabase_url> <anon_key> [--limit N] [--states CT,CO,WA]
"""
import json
import math
import os
import re
import sys
import time

import requests

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = ",".join([
    "places.id", "places.displayName", "places.location",
    "places.nationalPhoneNumber", "places.websiteUri", "places.regularOpeningHours",
])
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
# Google day numbers: 0=Sunday … 6=Saturday.
GDAY = {0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"}


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


def parse_hours(reg):
    """Places regularOpeningHours.periods -> {day:{open,close}|None}; None if unusable."""
    if not reg or "periods" not in reg:
        return None
    hours = {d: None for d in DAYS}
    got = False
    for p in reg["periods"]:
        o, c = p.get("open"), p.get("close")
        if not o or "day" not in o:
            continue
        day = GDAY.get(o["day"])
        oh, om = o.get("hour", 0), o.get("minute", 0)
        if not c:  # open 24h
            ot, ct = f"{oh:02d}:{om:02d}", "23:59"
        else:
            ch, cm = c.get("hour", 0), c.get("minute", 0)
            # crosses midnight -> clamp to end of day
            if c.get("day") != o["day"]:
                ch, cm = 23, 59
            ot, ct = f"{oh:02d}:{om:02d}", f"{ch:02d}:{cm:02d}"
        om_, cm_ = oh * 60 + om, int(ct[:2]) * 60 + int(ct[3:])
        if cm_ - om_ < 60:
            continue
        prev = hours[day]
        if prev is None:
            hours[day] = {"open": ot, "close": ct}
        else:  # widen to earliest open / latest close
            hours[day] = {"open": min(prev["open"], ot), "close": max(prev["close"], ct)}
        got = True
    return hours if got else None


def fetch_dispensaries(url, key, states=None):
    # Only rows still missing at least one of phone/website/hours — otherwise a
    # re-run pays for a fresh Places lookup on every already-enriched dispensary.
    rows, offset = [], 0
    while True:
        params = {"select": "slug,name,address,city,state,latitude,longitude,phone,website,hours,google_place_id",
                  "latitude": "not.is.null",
                  "or": "(phone.is.null,website.is.null,hours.is.null)",
                  "limit": 1000, "offset": offset}
        if states:
            params["state"] = f"in.({','.join(states)})"
        b = requests.get(f"{url}/rest/v1/dispensaries",
                         headers={"apikey": key, "Authorization": f"Bearer {key}"},
                         params=params, timeout=120).json()
        if not b:
            break
        rows += b
        offset += len(b)
        if len(b) < 1000:
            break
    return rows


def sql(v):
    return "null" if v in (None, "") else "'" + str(v).replace("'", "''") + "'"


def main():
    gkey = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not gkey:
        raise SystemExit("Set GOOGLE_PLACES_API_KEY")
    out, url, anon = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    states = None
    if "--states" in sys.argv:
        states = sys.argv[sys.argv.index("--states") + 1].split(",")

    disp = fetch_dispensaries(url, anon, states)
    if limit:
        disp = disp[:limit]
    print(f"querying Google Places for {len(disp)} dispensaries")
    headers = {"Content-Type": "application/json", "X-Goog-Api-Key": gkey, "X-Goog-FieldMask": FIELD_MASK}
    updates, matched = {}, 0
    for i, d in enumerate(disp):
        dl, dn = float(d["latitude"]), float(d["longitude"])
        q = " ".join(x for x in [d["name"], d.get("address"), d.get("city"), d.get("state")] if x)
        body = {"textQuery": q, "maxResultCount": 5,
                "locationBias": {"circle": {"center": {"latitude": dl, "longitude": dn}, "radius": 500.0}}}
        try:
            r = requests.post(SEARCH_URL, headers=headers, data=json.dumps(body), timeout=30)
            places = r.json().get("places", []) if r.status_code == 200 else []
        except Exception:
            places = []
        dtok = norm_name(d["name"])
        best, bestdist = None, 1e9
        for pl in places:
            loc = pl.get("location") or {}
            if "latitude" not in loc:
                continue
            dist = haversine_m(dl, dn, loc["latitude"], loc["longitude"])
            nm = (pl.get("displayName") or {}).get("text", "")
            if dist <= 150 and (dtok & norm_name(nm)) and dist < bestdist:
                bestdist, best = dist, pl
        if best:
            matched += 1
            sets = [f"google_place_id = {sql(best.get('id'))}"]
            if not d.get("phone") and best.get("nationalPhoneNumber"):
                sets.append(f"phone = {sql(best['nationalPhoneNumber'])}")
            if not d.get("website") and best.get("websiteUri"):
                sets.append(f"website = {sql(best['websiteUri'])}")
            if not d.get("hours"):
                h = parse_hours(best.get("regularOpeningHours"))
                if h:
                    sets.append(f"hours = '{json.dumps(h)}'::jsonb")
            updates[d["slug"]] = sets
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(disp)} ({matched} matched)")
        time.sleep(0.05)

    lines = [
        "-- Enrich dispensaries from the Google Places API (official API; place_id stored,",
        "-- phone/website/hours cached + refreshed; photos/reviews not stored per Google ToS).",
        f"-- Dispensaries matched: {len(updates)}",
        "",
    ]
    for slug in sorted(updates):
        lines.append(f"update public.dispensaries set {', '.join(updates[slug])} where slug = '{slug}';")
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"matched {matched}/{len(disp)}; wrote {out}")


if __name__ == "__main__":
    main()
