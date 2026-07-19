# Session hand-off — platform complete, launch phase

**Repo:** `AlwayzLegit/Weedtip` · **Web:** `apps/web` (Next.js 15 App Router, Turborepo/pnpm) ·
**Prod Supabase:** `ggpnghpcclngqkyelkes` · **Live:** https://www.weedtip.com · **git user:** AlwayzLegit

_Last updated 2026-07-19. `main` is fully deployed; every migration is applied to
production. The deep session-by-session record lives in the memory file
`weedtip-project-state.md` — this file is only the orientation summary._

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
- **Owner platform**: 3-tier freemium (Free $0 / Basic $29 / Growth $99,
  grandfathered claims) · full listing editor incl. change-history audit log ·
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

## What to do next

1. **Launch ops** — the ordered owner checklist is `docs/LAUNCH-RUNBOOK.md`
   (auth-email hook, outreach sender, house fills, first OK campaign).
2. **Parked, waiting on externals**: PaymentCloud gateway (rep), POS OAuth
   (owner's call), live driver GPS (needs a driver client), the owner's
   detailed claim-funnel instructions (promised, not yet sent).
3. **Flutter mobile app** — consumer app has drifted badly (dark theme, no
   deals/tiers/delivery statuses). Needs a dedicated catch-up session if
   mobile matters.
4. **Measurement** — re-pull the Semrush audit to score the SEO fixes; watch
   outreach campaign conversion in `/admin/outreach`.

## Invariants (never violate)

- **Freemium:** Free = 0% commission forever; Basic $29 / Growth $99. No
  Weedmaps-style required ad spend.
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
