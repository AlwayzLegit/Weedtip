# Session hand-off — platform complete, launch phase

**Repo:** `AlwayzLegit/Weedtip` · **Web:** `apps/web` (Next.js 15 App Router, Turborepo/pnpm) ·
**Prod Supabase:** `ggpnghpcclngqkyelkes` · **Live:** https://www.weedtip.com · **git user:** AlwayzLegit

_Last updated 2026-07-24. `main` is fully deployed; every migration is applied to
production. The deep session-by-session record lives in the memory file
`weedtip-project-state.md` — this file is only the orientation summary._

---

## START HERE: run the Google ratings backfill

**This is the single highest-leverage action available, and nothing else on the
list matters as much until it's done.**

The directory has ~9,110 active listings and **one** review between them. The
whole ratings and ranking layer is built and deployed but sits dark: every
rating cue is blank, the map's _Top rated_ / _Most reviewed_ sorts order by a
column that is zero for all but one row, and **every `/best-dispensaries/*` and
`/best-delivery/*` page 404s** (they gate on three rated shops per city).

~6,967 listings already carry a `google_place_id`. One backfill turns all of
that on.

**Runbook: `docs/GOOGLE-RATINGS-BACKFILL.md`.**
**Script: `apps/web/scripts/backfill-google-ratings.mjs`.**

It cannot be run from a cloud session — `GOOGLE_PLACES_API_KEY` lives only in
Vercel's production env. Run it locally, or click **Import ratings** on
`/admin/integrations` in prod.

It is also a **recurring** job: ratings older than 30 days are treated as
absent (that's what keeps us inside Google's caching terms), so best-of pages
will go dark again if it stops running. Worth a monthly cron.

---

## Where things stand: the platform is feature-complete for launch

Everything from the P0–P4 Weedmaps-parity spec, the delivery roadmap (#42), and
the July polish sprint is **built, verified, and deployed**:

- **Consumer**: light/pastel design system · location address-modal (geocoded,
  personalizes the whole site) · full-page map finder with floating results ·
  merchandised ranking (featured → paid tier → relevance) with Sponsored
  labeling · city hubs with top-rated + deals rails · Weedmaps-grade strain
  pages (art hero, family color identity) and brand pages (cover banner,
  verified badge, category-grouped catalog) · deals/promos storefronts ·
  branded placeholders everywhere an image is missing.
- **Owner platform**: two-tier plan (Free $0 / **Weedtip Pro $39**, grandfathered
  claims) · full listing editor incl. change-history audit log ·
  deals wizard + promo codes + creative library/scheduler/insights · orders
  board with delivery dispatch (drivers, ETA, out-for-delivery) · taxes, team
  RBAC (4-role matrix enforced in RLS), analytics, QR, Google sync ·
  marketing-spend report · tiered setup unlocks (advertising requires
  logo+cover+hours+3 products).
- **Ads engine v2**: fixed scarce inventory per region (1 exclusive / 3
  featured / 10 premium) · **dynamic step pricing** (+15%/spot sold, launch →
  list cap) · renewal first-right at current price · sold-out waitlists ·
  cold-start **house fills** (comped, "Featured"-labeled, auto-preempted by
  paid claims) · everything managed from **`/admin/ads-desk`** — email is a
  copy, the desk is the system of record. Brand bidding is mothballed; brands
  use the same fixed-price placement model.
- **Growth loop**: claim-outreach engine (state-targeted campaigns, reminder
  drip, registry-contact reach = 2,864 contactable shops) → tracked claim
  links → tier-aware claim funnel → pending subscription in `/admin/billing`.

## Shipped since 2026-07-19

- **Plans re-engineered** to Free + Weedtip Pro $39 with everything in it;
  Stripe fully retired, activation is sales-led via `/admin/billing`.
- **Ads bundled into Pro** — activation auto-grants a Featured slot flagged
  `is_house`/`plan_included` so it never inflates step pricing and stays
  preemptable by paying buyers; waitlists via `ad_requests` when the region is
  full.
- **Admin**: unified `/admin/dispensaries/[id]/promote`, region-scoped
  advertise picker, and a shop-lookup that answers "what region is this shop
  in, what's on the map for it, and what applies to them" in one view.
- **Best-of ranked pages** (`/best-dispensaries/*`, `/best-delivery/*`, plus the
  index hub) on a Bayesian score, and the **terpene library**.
- **Google ratings**: capture layer + attributed display + ranking integration,
  with the best-of methodology copy rewritten to state its real source mix
  rather than claiming "verified customer reviews".
- **Owner onboarding wizard** at `/get-started` — see below.

## What to do next

1. **Run the ratings backfill** — see START HERE. Everything ranking-related is
   inert until this lands.
2. **Owner activation depth** — two known gaps, deliberately left for their own
   slice: the dashboard setup checklist has **4 of its 7 steps behind the
   paywall** of the free plan owners are defaulted into (so it caps at 43% and
   nobody ever sees "fully set up"), and there are **three divergent
   definitions of "complete listing"** across `lib/onboarding.ts`,
   `lib/promotion-gate.ts`, and `lib/ranking.ts`.
3. **Launch ops** — the ordered owner checklist is `docs/LAUNCH-RUNBOOK.md`
   (auth-email hook, outreach sender, house fills, first OK campaign).
4. **Parked, waiting on externals**: PaymentCloud gateway (rep), POS OAuth
   (owner's call), live driver GPS (needs a driver client).
5. **Flutter mobile app** — consumer app has drifted badly (dark theme, no
   deals/tiers/delivery statuses). Needs a dedicated catch-up session if
   mobile matters.
6. **Measurement** — re-pull the Semrush audit to score the SEO fixes; watch
   outreach campaign conversion in `/admin/outreach`.

## Owner onboarding — how `/get-started` works

One wizard replaced four disconnected surfaces (a static `/claim` explainer, the
directory, a claim box buried on the public listing page, and the dashboard's
create-listing form). Steps: what you run → find your business → your account →
verify ownership → choose a plan.

**The wizard stores no progress of its own.** `lib/onboarding-flow.ts` derives
the current step from real state — signed in? account able to claim? business
picked? claim status? already managing a listing? That is what makes it
resumable across the email-confirmation wait and a multi-day claim review. The
only persisted thing is the business chosen _before_ an account existed, which
rides in the `wt_onboarding` cookie.

Things to preserve when touching it:

- **Never pre-fill the license number.** Comparing what the owner types against
  the state record is the strongest self-serve verification signal there is;
  pre-filling would make every claim "match" and render it worthless.
- A `consumer` may promote their own profile to `dispensary_owner` (and only
  that transition, on their own row) — see
  `20260724230000_self_serve_business_account.sql`. This is what unblocked
  Google sign-in for owners and removed the confirmation-email wall.
- `requireOwnerDispensary` sends listing-less owners to `/get-started`, **not**
  to the create-listing form — routing a pending claimant to file a duplicate
  was the worst moment in the old funnel.

## Invariants (never violate)

- **Freemium:** Free = 0% commission forever; one paid tier, **Weedtip Pro
  $39/mo**, with every feature in it (the Basic/Growth ladder was retired
  2026-07-24 at the owner's direction — `apps/web/lib/plan.ts` is the source of
  truth). Pro bundles a Featured regional placement, granted on activation and
  waitlisted when the region is full. No Weedmaps-style required ad spend.
- **Light pastel theme + tokens** (the dark theme was retired 2026-07-18 at
  the owner's direction) — additive modules using existing tokens.
- **Reserve-then-confirm billing** — sales-led, no card in-flow; self-serve
  buys create PENDING records handled in `/admin/billing` + `/admin/ads-desk`.
- **Shoppers NEVER pay through Weedtip** (100% B2B revenue).
- **Honest ad labeling** — paid = "Sponsored", house-comped = "Featured".
- Hyphenated slugs; every data view needs skeleton/empty/error states.

## Working conventions

- Migrations: apply to prod via MCP `apply_migration` (additive migrations are
  pre-authorized); keep the repo file identical; hand-update
  `packages/supabase/src/types/database.types.ts`.
- Ship in verified slices: tsc + eslint + build → verify → commit
  `claude/<slice>` → merge `--no-ff` → fetch/rebase → push (Vercel deploys).
  The session cwd `Desktop/Weed Tip` is a STALE clone — always work in
  `Desktop/Weedtip-fresh`.
- Verification: rolled-back prod transactions with
  `set_config('request.jwt.claims', …)` for RLS-true testing; for interactive
  browser testing run a local **production** build (`next build` + `next
start`) — `next dev` never hydrates in the test harness.
- Persistent e2e logins (prod): `alwayzlegit+e2e{owner,shopper,brand}@gmail.com`
  / `E2eTest!2026`. No admin test login — admin surfaces are owner-verified.
