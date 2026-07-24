# Runbook: Google ratings backfill

Populates `google_rating` / `google_rating_count` / `google_maps_uri` for active
listings already matched to a Google Place.

**This is a recurring job, not a one-off.** Google Maps Platform permits only
temporary caching of Places content, so `apps/web/lib/google-rating.ts` treats
any rating older than **30 days** as absent — not displayed, not ranked on.
Stale rows re-enter the queue automatically, so **re-running this monthly is
what keeps ratings visible at all.**

---

## Why it matters

The directory has ~9,110 active listings and **one** Weedtip review between
them. Until this runs:

- every rating cue on every card and listing page is blank,
- the map's _Top rated_ and _Most reviewed_ sorts order by a column that is zero
  for all but one row,
- and **every `/best-dispensaries/*` and `/best-delivery/*` page 404s** — they
  gate on three rated shops per city.

~6,967 listings already carry a `google_place_id`, which is what makes this the
highest-leverage single job in the repo.

---

## Two ways to run it

### A. Standalone script (preferred)

No dev server, no admin session — talks to Supabase with the service-role key.

```bash
cd apps/web

export NEXT_PUBLIC_SUPABASE_URL='https://ggpnghpcclngqkyelkes.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='...'   # apps/web/.env.local
export GOOGLE_PLACES_API_KEY='...'       # Vercel → Settings → Environment Variables

# 1. prove the key works; writes nothing
DRY_RUN=1 LIMIT=20 node scripts/backfill-google-ratings.mjs

# 2. small real run
LIMIT=100 node scripts/backfill-google-ratings.mjs

# 3. the whole queue
node scripts/backfill-google-ratings.mjs
```

Ctrl-C is safe at any point — progress is written per row, and re-running picks
up whatever is still queued. Budget ~15–25 min for a full run at 8 concurrent
requests.

The script paces itself under Google's per-minute `GetPlaceRequest` quota
(default budget 550/min; override with `PACE_PER_MIN=`). A `429` backs off one
quota window and retries once — the 2026-07 initial run predated this and needed
manual re-run loops; a full run now completes in a single invocation.

### B. In-app admin console

`/admin/integrations` → **Import ratings** in the _Import & refresh Google
ratings_ panel. Identical semantics; loops batches client-side, so the tab has
to stay open. Use this if you'd rather not handle the service-role key locally.

---

## Prerequisites

| Secret                      | Where it lives                        |
| --------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | `apps/web/.env.local`                 |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/web/.env.local`                 |
| `GOOGLE_PLACES_API_KEY`     | **Vercel only** — production env vars |

The key needs **Places API (New)** enabled. If it carries an HTTP-referrer
restriction it will `403` from a script; use an unrestricted server key or
temporarily allow your IP. The dry run surfaces this in 20 calls.

**Cost:** one Place Details call per listing, field-masked to
`rating,userRatingCount,googleMapsUri` so it bills at the cheapest SKU tier.

---

## Verifying

```sql
select
  count(*) filter (where google_rating is not null)                             as rated,
  count(*) filter (where google_rating is null and google_rating_at is not null) as unrated_on_google,
  count(*) filter (where google_place_id is not null and google_rating_at is null) as still_queued,
  round(avg(google_rating)::numeric, 2)                                          as avg_rating
from public.dispensaries
where status = 'active';
```

Then the product surfaces:

- **any listing page** — an unreviewed shop should show stars plus _"N ratings
  on Google"_, linking out to the Google listing;
- **`/dispensaries`** — the _Top rated_ sort should finally reorder;
- **`/best-dispensaries`** — should go from empty to listing real cities. This is
  the clearest end-to-end proof. Dense metros appear first, since a city needs
  three rated shops to qualify.

---

## Invariants — do not "fix" these

**Google ratings never merge into ours.** They live in their own columns;
`rating_avg` / `rating_count` stay first-party. `displayRating()` in
`lib/google-rating.ts` is the single place that decides which to show: Weedtip
reviews win whenever a shop has them, and a Google-sourced number is always
labelled and linked as Google's.

**The `aggregateRating` JSON-LD emits only first-party review counts.** Marking
up someone else's ratings as our own aggregate is a structured-data violation.
Leave it alone even though it makes the numbers look smaller.

**Stale means absent.** Past the 30-day window a rating stops being displayed
_and_ stops counting toward ranking and best-of eligibility. That is deliberate —
it is what keeps us inside the caching terms — so best-of pages can disappear
again if this job stops running.

**Errors are transient by default.** A row that errors isn't stamped, so it
stays queued; just re-run. A `404` (dead `place_id`) _is_ stamped, so it isn't
re-billed until the window lapses.
