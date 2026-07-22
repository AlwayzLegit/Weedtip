#!/usr/bin/env python3
"""Derive dispensary logos from their website domain's favicon.

Same approach as the brand logos: a domain favicon (Google S2, 128px) is a
reasonable logomark and is freely usable/storable. Fills logo_url only where it
is null and a website exists. Owners can upload a high-res logo on claim.

Aggregator/menu domains (weedmaps, leafly, …) are skipped so we don't show a
directory's logo as the shop's.

Usage: python scripts/gen-dispensary-logos.py <out.sql> <supabase_url> <anon_key>
"""
import sys
from urllib.parse import urlparse

import requests

FAVICON = "https://www.google.com/s2/favicons?domain={host}&sz=128"
# Don't use these as a logo source — they're directories/menu platforms, not the shop.
SKIP_HOSTS = {
    # Menu / aggregator platforms — favicon is the platform's, not the shop's
    "weedmaps.com", "leafly.com", "iheartjane.com", "jane.com", "dutchie.com",
    "allbud.com", "potguide.com", "wheresweed.com", "leaflink.com", "getmeadow.com",
    "meadow.com", "tymber.io", "sweed.io", "blaze.me", "greenrush.com", "dispenseapp.com",
    "webjoint.com",
    # Social / link-in-bio
    "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com", "linktr.ee",
    "linktree.com", "beacons.ai", "snapchat.com", "youtube.com",
    # Generic / non-brand
    "google.com", "sites.google.com", "business.site", "bit.ly", "yelp.com",
}


def host_of(url):
    try:
        h = urlparse(url if "//" in url else f"http://{url}").netloc.lower()
        h = h.split("@")[-1].split(":")[0]
        if h.startswith("www."):
            h = h[4:]
        return h or None
    except Exception:
        return None


def fetch(url, key):
    rows, offset = [], 0
    while True:
        b = requests.get(f"{url}/rest/v1/dispensaries",
                         headers={"apikey": key, "Authorization": f"Bearer {key}"},
                         params={"select": "slug,website,logo_url",
                                 "website": "not.is.null", "logo_url": "is.null",
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
    rows = fetch(url, key)
    updates = {}
    skipped = 0
    for r in rows:
        h = host_of(r["website"])
        if not h or any(h == s or h.endswith("." + s) for s in SKIP_HOSTS):
            skipped += 1
            continue
        updates[r["slug"]] = FAVICON.format(host=h)
    lines = [
        "-- Dispensary logos from website-domain favicons (Google S2, 128px); logo_url was null.",
        f"-- Logos set: {len(updates)} (skipped {skipped} aggregator/menu/no-host)",
        "",
    ]
    for slug in sorted(updates):
        u = updates[slug].replace("'", "''")
        lines.append(f"update public.dispensaries set logo_url = '{u}' where slug = '{slug}' and logo_url is null;")
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"candidates: {len(rows)} | logos: {len(updates)} | skipped: {skipped}; wrote {out}")


if __name__ == "__main__":
    main()
