#!/usr/bin/env python3
"""Generate a migration setting brand website + logo for known brands.

No free keyless logo-by-domain API exists (Clearbit's shut down), so logos use
the brand domain's favicon (Google s2, 128px) — often the brand's logomark —
and `website` is set to the official domain. Only brands whose domain VERIFIES
(HTTP 200) are written, so we don't store dead/wrong URLs. Brands not in the map
keep their letter-avatar fallback; owners can upload a high-res logo on claim.

Usage: python scripts/gen-brand-logos.py <out.sql>
"""
import sys
import concurrent.futures as cf

import requests

# Curated slug -> official domain for recognizable brands (high confidence).
DOMAINS = {
    "cookies": "cookies.co",
    "stiiizy": "stiiizy.com",
    "raw-garden": "rawgarden.farm",
    "wyld": "wyldcanna.com",
    "kiva": "kivaconfections.com",
    "connected-cannabis-co": "connectedcannabis.com",
    "alien-labs": "alienlabs.org",
    "jungle-boys": "jungleboys.com",
    "sherbinskis": "sherbinskis.com",
    "lemonnade": "lemonnade.com",
    "glass-house-farms": "glasshousefarms.com",
    "lowell-farms": "lowellfarms.com",
    "claybourne-co": "claybourneco.com",
    "maven-genetics": "mavengenetics.com",
    "henry-s-original": "henrysoriginal.com",
    "flow-kana": "flowkana.com",
    "thc-design": "thcdesign.com",
    "heavy-hitters": "heavyhitters.co",
    "plugplay": "plugplay.com",
    "friendly-farms": "friendlyfarms.com",
    "710-labs": "710labs.com",
    "jetty-extracts": "jettyextracts.com",
    "west-coast-cure": "westcoastcure.com",
    "kurvana": "kurvana.com",
    "packwoods": "packwoods.com",
    "dabwoods": "dabwoods.com",
    "papa-and-barkley": "papaandbarkley.com",
    "care-by-design": "carebydesign.com",
    "mary-s-medicinals": "marysmedicinals.com",
    "wana-brands": "wanabrands.com",
    "plus-products": "plusproducts.com",
    "jeeter": "jeeter.com",
    "old-pal": "oldpal.com",
    "caliva": "caliva.com",
    "cann": "drinkcann.com",
    "keef": "keefbrands.com",
    "pabst-labs": "pabstlabs.com",
    "uncle-arnie-s": "unclearnies.com",
    "lord-jones": "lordjones.com",
    "garden-society": "gardensociety.com",
    "cresco": "crescolabs.com",
    "rythm": "rythm.com",
    "curaleaf": "curaleaf.com",
    "trulieve": "trulieve.com",
    "verano": "verano.com",
    "1906": "1906newhighs.com",
    "cheeba-chews": "cheebachews.com",
    "beboe": "beboe.com",
    "dosist": "dosist.com",
    "houseplant": "houseplant.com",
    "tyson-2-0": "tyson20.com",
    "coda-signature": "codasignature.com",
    "binske": "binske.com",
    "theory-wellness": "theorywellness.org",
    "insa": "insa.com",
    "berkshire-roots": "berkshireroots.com",
    "fernway": "fernway.com",
    "item-9-labs": "item9labs.com",
    "klutch": "klutchcannabis.com",
    "stillwater": "stillwaterbrands.com",
    "ripple": "tryripple.com",
    "phat-panda": "phatpanda.com",
    "buddies": "buddiesbrand.com",
    "airo": "airopro.com",
    "select": "selectcannabis.com",
    "rove": "rove.co",
    "almora-farm": "almorafarm.com",
    "fig-farms": "figfarms.com",
    "pure-beauty": "purebeauty.com",
    "grandiflora": "grandiflora.net",
    "backpack-boyz": "backpackboyz.com",
    "wonderbrett": "wonderbrett.com",
    "kanha": "kanhatreats.com",
    "smokiez-edibles": "smokiezedibles.com",
    "good-day-farm": "gooddayfarm.com",
    "stratos": "stratospills.com",
    "veritas-fine-cannabis": "veritascannabis.com",
    "highly-edible": "highlyedibles.com",
    "khalifa-kush": "khalifakush.com",
    "runtz": "runtz.com",
}

HEADERS = {"User-Agent": "Mozilla/5.0 Chrome/120 Safari/537.36"}


def verify(item):
    slug, domain = item
    for scheme in ("https://", "http://"):
        try:
            r = requests.get(scheme + domain, headers=HEADERS, timeout=15, allow_redirects=True)
            if r.status_code < 400:
                return slug, domain
        except Exception:
            pass
    return slug, None


def main():
    out = sys.argv[1]
    verified = {}
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for slug, domain in ex.map(verify, DOMAINS.items()):
            if domain:
                verified[slug] = domain
    print(f"verified {len(verified)}/{len(DOMAINS)} domains")
    lines = [
        "-- Set brand website + logo (favicon) for recognizable brands with a verified domain.",
        "-- Logos use the domain favicon (no free logo API); owners can upload high-res on claim.",
        f"-- Brands updated: {len(verified)}",
        "",
    ]
    for slug in sorted(verified):
        d = verified[slug]
        logo = f"https://www.google.com/s2/favicons?domain={d}&sz=128"
        lines.append(
            f"update public.brands set website = 'https://{d}', "
            f"logo_url = '{logo}' where slug = '{slug}';"
        )
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("wrote", out)


if __name__ == "__main__":
    main()
