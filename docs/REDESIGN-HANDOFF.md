> **Historical note (July 2026):** Stripe has since been removed entirely — Weedtip never charges shoppers (pay at store / pay the delivery partner) and B2B billing is sales-led via /admin/billing pending the PaymentCloud gateway. Stripe references below are obsolete.

# Redesign Handoff — Weedmaps-Parity UI Overhaul

**For the next Claude session.** Read this first, then start Phase 1.
Owner directive: "We need to look like a modern website… follow Weedmaps' site
structure, page structure, and navigation. Maps need to be actually usable like
Google Maps, integrated — not a separate page."

---

## 1. Where the platform stands (all shipped & deployed)

PRs #86–#105 are squash-merged to `main` and live at **weedtip.com** (Vercel,
project `weedtip-web`, team `alwayzlegits-projects`). Supabase project:
`ggpnghpcclngqkyelkes`. 9,422 active dispensaries across 42 states.

Functional layer is DONE — do not re-audit it:
- Claims v2 (license auto-match + admin notify), Google sync page (`/dashboard/google`).
- Per-state tax + legality enforcement (`operating_regions.tax_rate`, `checkout_rules()` RPC).
- Orders hardened (server-authoritative, `app.orders_trusted` flag in RPCs).
- Per-dispensary `timezone`; open-now correct everywhere.
- Admin: pagination, typeahead pickers, edit page, merge/delete RPCs
  (`admin_merge_dispensaries`, `admin_delete_dispensary`), Google enrichment
  console (`/admin/integrations`).
- ISR on public pages via `lib/supabase/static.ts` (cookieless anon client) —
  personalized pages keep `lib/supabase/server.ts`.
- Market selector (navbar, `wt_state` cookie, geo-seeded in `middleware.ts`).
- Brand-lineup catalog live on /products, /products/[category], /brands
  (1,629 `brand_products`).
- City pages have a v1 split map+list (`components/city-browser.tsx`).
- CSP fixed for Mapbox GL v3 (`'wasm-unsafe-eval'`) — base tiles render now.
- ~6,976 shops have live Google photo covers (`/api/dispensary-cover/[slug]`);
  owner should click "Run enrichment" in /admin/integrations for the rest.

## 2. The mission: 4 redesign phases (in order)

### Phase 1 — Map-first discovery (START HERE)
Rebuild `/dispensaries` as THE map experience (Weedmaps/Google Maps pattern);
retire the separate `/map` page (redirect it):
- Full-viewport split: scrollable result list left (~40%), **sticky full-height
  map** right. Mobile: map with bottom-sheet list, or List/Map toggle.
- **"Search this area"** button appears on map move; re-queries by bounds
  (`search_dispensaries` RPC already takes lat/lng/radius; may need a bounds
  variant).
- Hover card ↔ highlight pin; click pin → popup card (photo, rating, Open
  badge, View menu). Locate-me control. Filter pills on top (Open now,
  Pickup, Delivery, Medical, Rec, Sort) — server round-trip via RPC, not the
  client-side filter used in city-browser.
- Reuse/extend `components/explore-map.tsx` (clusters exist) and
  `city-browser.tsx` learnings. Keep city pages on the same shell.

### Phase 2 — Homepage as merchandised feed
Weedmaps structure: location-aware header ("Shopping in {State}") · illustrated
category tiles · horizontal carousels (Featured dispensaries / Brands / Deals
near you — use `wt_state`) · region/city link grid (SEO) · keep "How it works"
+ B2B CTA (they're better than Weedmaps').

### Phase 3 — Card system rebuild
One family: photo, rating stars + count, live Open/Closed chip (compute from
`hours` + `timezone`, client-side like city-browser does), deal badge,
distance when known, fulfillment icons. Apply site-wide (DispensaryCard,
ProductCard, LineupCard, deal cards).

### Phase 4 — Dispensary page "claimed" look
Hero banner (cover photo) + overlapping logo, action row (Directions · Call ·
Website · Add review), rating summary up top, sticky menu-category bar,
deals strip. Must look complete even with an empty menu.

## 3. Conventions this repo expects
- Branch `claude/<topic>` → PR → wait for Vercel status + GitHub Actions CI
  (`ci.yml` runs lint/typecheck/test/build) → squash-merge. User pre-approved
  merging when green ("merge and deploy").
- **Local `next build` fails in the cloud sandbox** (Google Fonts vs egress
  proxy) — CI is the build gate; typecheck/lint/test locally.
- DB changes: write migration file in `packages/supabase/supabase/migrations/`
  AND apply via `mcp__Supabase__apply_migration`. Hand-edit
  `packages/supabase/src/types/database.types.ts` to match (zero-arg fns use
  `Args: never`).
- `pnpm format` reformats the whole repo — do NOT run it; commit only your
  files (prettier churn polluted a commit once; per-file staging fixed it).
- Design tokens: Tailwind classes like `bg-surface`, `border-border`,
  `text-muted`, `rounded-card`, `text-primary`, `card`/`sheen` utilities —
  stay in this system. Dark theme + green accent is the brand; keep it.
- ISR pages must not read cookies/headers/searchParams (use client components
  hydrating `wt_state`, like `market-banner.tsx`).

## 4. Gotchas
- `mapbox-gl` v3 needs the CSP as-is in `next.config.mjs` — don't tighten
  script-src without keeping `'wasm-unsafe-eval'`.
- `search_dispensaries` returns `total_count` + `is_open_now` (per-shop tz).
- Cover URLs are `/api/dispensary-cover/{slug}` (live Google proxy, CDN-cached
  7d). Some 404 (no Google photo) — MediaImage falls back to gradient.
- Orders RPCs must `set_config('app.orders_trusted','1',true)` before insert.
- 408 of the "duplicate" name+city groups are DISTINCT licenses — not dupes.

## 5. Waiting on the owner
- Click **Run enrichment** in /admin/integrations (~$100 Google spend, fills
  most remaining photos/place links).
- Review per-state tax rates in /admin/regions (seeded estimates charge real money).
- Google Business Profile OAuth app (enables two-way sync write-back).
- Stripe keys when card payments should go live.
