# SEO remediation — SEMrush Site Audit

Source: SEMrush Site Audit, project `weedtip.com` (30288580), latest crawl
snapshot `6a52da61…` — 17,966 pages crawled. **Site Health 84%** (quality
delta +4), **AI Search Score 78** (+5). Thematic scores: HTTPS 100, On-page
SEO 100, Performance 100, Markups 99, Crawlability 72, Internal Linking 70.

Totals: **1,873 errors · 43,294 warnings · 33,639 notices** (all trending
down crawl-over-crawl). The counts look huge but collapse to a **small number
of root causes**, most of them one template or one data problem repeated
across ~17k pages.

## Root-cause map (what actually drives the numbers)

| # | Root cause | Issues it creates (SEMrush count) | Fix type |
|---|---|---|---|
| A | **Duplicate dispensary rows** — same shop imported under many slugs (`livwell`…`livwell-denver` = 10 rows; `uncle-ike-s` ×5) | Duplicate title tags (761), duplicate content (163), duplicate meta descriptions (944) → **~1,868 of the 1,873 errors** | Data dedup (prod) |
| B | **Thin directory + strain pages** (~130–185 words) | Low word count (8,691), low text-to-HTML ratio (16,975) | Content |
| C | **Weak internal linking** — leaf pages reachable only via sitemap | Only-one-internal-link (11,489), orphaned sitemap pages (4,071, *growing*), crawl depth >3 (22) | Code (linking) |
| D | **Product JSON-LD missing `offers`** on imageless/unreviewed products | Structured-data markup errors (5) | Code ✅ **fixed** |
| E | **Stale nav redirect** — `/dispensaries` used to 308→`/map` sitewide | Permanent redirects (16,975), temporary redirects (16,975) | Verify (already 200 live) |
| F | Robots / crawl hygiene | Blocked from crawling (981), disallowed internal resources (371) | Config audit |
| G | Dead third-party links | Broken external links (212), external 403 (100) | Periodic validation |
| H | Long titles | Title too long (70) | Code (template) |

## Priority plan

### ✅ Done this session (code, safe)
- **D — Product structured data:** `app/product/[id]/page.tsx` now only emits
  the `Product` JSON-LD when it's valid (has `offers` / `aggregateRating` /
  `review`). Imageless, unreviewed products emitted a bare `Product` node that
  Google + SEMrush reject; those now render no markup instead of broken markup.
  Clears the 5 structured-data errors and stops new ones.

### ✅ Done — dedup, sitemap, and technical SEO (this session)
- **A — Deduplicated dispensary rows** (migration `20260714100000`, applied):
  location-aware key removed 302 same-location duplicates (9,422 → 9,119
  active), 0 claimed touched; retired slugs 301-redirect to survivors via the
  new `dispensary_redirects` table; demo Green Leaf NYC removed. Clears the
  duplicate-title/content/meta error cluster on the next crawl.
- **Sitemap sharded** (`app/sitemap.ts` via `generateSitemaps()`): 4 shards
  (pages 2,813 · catalog 442 · dispensaries 9,119 · products) each far under
  the 50k cap and future-proof; `robots.txt` lists every shard explicitly.
- **Sitewide Organization + WebSite/SearchAction** moved to the root layout.
- **`/advertise`** now sets canonical + OG/Twitter (was the one page missing it).
- **Entity schema added:** strain pages (Product + THC `additionalProperty` +
  type Brand), brand pages (Brand), and the dispensary schema upgraded to
  `["Store","LocalBusiness"]` with logo, `currenciesAccepted`,
  `availableDeliveryMethod`, and aggregateRating driven by the rating columns
  (not just loaded text reviews). Invalid imageless Product schema already
  fixed earlier.

### Tier 1 (superseded) — original dedup note
- **A — Deduplicate dispensary rows.** 411 duplicate groups, **609 removable
  rows, 0 of them claimed** (verified against prod). This is what creates
  ~1,868 of the errors. Plan:
  1. Script: group active dispensaries by `(lower(name), state, city)`; within
     each group keep the **best-enriched** row (has `google_place_id`, cover,
     phone, most complete), delete the rest.
  2. Add a `dispensary_redirects(old_slug → new_slug)` table + a catch-all in
     `app/dispensary/[slug]` that 301s a retired slug to the survivor, so any
     indexed/linked old URLs pass equity instead of 404ing.
  3. Feed the survivors' slugs into `refresh-ca-data.sh` reserved-slugs so the
     monthly refresh never re-splits them.
  - Prod DELETE is classifier-gated (and a judgment call on which row wins), so
    it ships as a reviewed script + migration you approve — not an autonomous
    delete. Also fold in the demo `Green Leaf NYC` removal from the monetization
    audit here (same "clean the directory" pass).

### Tier 2 — internal linking + content (code, medium build)
- **C — Interlink the directory.** Leaf pages (dispensary, strain, product) sit
  at crawl depth with a single inbound link. Add: "Nearby dispensaries" and
  "More in {city}/{state}" rails on dispensary pages; city ↔ neighboring-city
  and city → state cross-links; "Related strains" on strain pages; ensure
  breadcrumbs are linked everywhere. Directly attacks only-one-internal-link
  (11,489) and orphaned-sitemap (4,071), and lifts the Internal Linking score
  (currently 70).
- **B — Thicken thin pages.** Strain pages are ~178 words: add a real
  description, effects/flavors prose, and a short FAQ (we already emit FAQ
  schema on 11k pages — pair it with visible copy). City/dispensary pages: a
  1–2 sentence localized intro ("Cannabis dispensaries in {city}, {state} —
  {N} licensed shops…"). De-index or `canonical` the thin `/strains?type=…`
  param pages to the main `/strains`.
- **H — Trim long titles** (70 pages) in the affected `pageSeo()` templates to
  ≤ 60 chars.

### Tier 3 — verify + hygiene (low effort)
- **E — Confirm the redirect is gone.** Live `/dispensaries` already returns
  200 (the 16,975 permanent/temporary redirects were captured pre-deploy);
  they should drop on the next crawl. Re-run the audit to confirm; if any
  persist, point the nav/footer link at the final URL.
- **F — Robots audit.** 981 pages "blocked from crawling" + 371 disallowed
  internal resources — confirm `robots.txt` isn't blocking real content or the
  CSS/JS SEMrush needs to render; unblock anything indexable.
- **G — Dead external links.** 212 broken + 100 returning 403 to the bot — a
  periodic validator over dispensary `website` values (mark dead ones null or
  `rel="nofollow"`); many 403s are just bot-blocking and can be ignored.

## Expected impact

Tier 1 alone clears ~1,868 of 1,873 errors (Health → ~mid-90s). Tier 2 lifts
the two lagging thematic scores (Crawlability 72, Internal Linking 70) and the
low-content warnings — the levers that most affect actual ranking for a
directory. Re-crawl after each tier to measure.
