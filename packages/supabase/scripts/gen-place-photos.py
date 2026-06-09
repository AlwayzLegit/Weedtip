#!/usr/bin/env python3
"""Fetch Google Places photo references for dispensaries (official API).

For each mapped dispensary with a google_place_id, calls Place Details (New)
requesting only the `photos` field and stores the first photo's resource name in
google_photo_name. Also points cover_image_url at the live photo route so the
existing card/detail rendering picks it up. The image itself is served live by
/api/dispensary-cover (Google ToS: store the reference, fetch media on demand).

Cost: Place Details (photos) ≈ $0.017 per shop. Use --limit to test.

Env:  GOOGLE_PLACES_API_KEY
Usage: python scripts/gen-place-photos.py <out.sql> <supabase_url> <anon_key> [--limit N]
"""
import os
import sys
import time

import requests

DETAILS = "https://places.googleapis.com/v1/places/{pid}"


def fetch(url, key):
    rows, offset = [], 0
    while True:
        b = requests.get(f"{url}/rest/v1/dispensaries",
                         headers={"apikey": key, "Authorization": f"Bearer {key}"},
                         params={"select": "slug,google_place_id,cover_image_url,google_photo_name",
                                 "google_place_id": "not.is.null", "google_photo_name": "is.null",
                                 "limit": 1000, "offset": offset}, timeout=120).json()
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
    gkey = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not gkey:
        raise SystemExit("Set GOOGLE_PLACES_API_KEY")
    out, url, anon = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None

    disp = fetch(url, anon)
    if limit:
        disp = disp[:limit]
    print(f"querying Place Details (photos) for {len(disp)} dispensaries")
    headers = {"X-Goog-Api-Key": gkey, "X-Goog-FieldMask": "photos"}
    updates, with_photo = {}, 0
    for i, d in enumerate(disp):
        try:
            r = requests.get(DETAILS.format(pid=d["google_place_id"]), headers=headers, timeout=30)
            photos = r.json().get("photos", []) if r.status_code == 200 else []
        except Exception:
            photos = []
        if photos:
            with_photo += 1
            sets = [f"google_photo_name = {sql(photos[0]['name'])}"]
            if not d.get("cover_image_url"):
                sets.append(f"cover_image_url = '/api/dispensary-cover/{d['slug']}'")
            updates[d["slug"]] = sets
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(disp)} ({with_photo} with photo)")
        time.sleep(0.05)

    lines = [
        "-- Google Places photo references (official API). Image served live via /api/dispensary-cover.",
        f"-- Dispensaries with a photo: {len(updates)}",
        "",
    ]
    for slug in sorted(updates):
        lines.append(f"update public.dispensaries set {', '.join(updates[slug])} where slug = '{slug}';")
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"with photo: {with_photo}/{len(disp)}; wrote {out}")


if __name__ == "__main__":
    main()
