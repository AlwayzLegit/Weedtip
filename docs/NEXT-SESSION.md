# Next session hand-off — Deals Engine (P2 ①) + Weedmaps-parity roadmap

**Repo:** `AlwayzLegit/Weedtip` · **Web:** `apps/web` (Next.js 15 App Router, Turborepo/pnpm) ·
**Prod Supabase:** `ggpnghpcclngqkyelkes` · **Live:** https://www.weedtip.com · **git user:** AlwayzLegit

`main` is fully deployed (HEAD `641bd66`). Production DB is clean of test data.

> Historical note: an earlier version of this file was a one-time deployment kickoff (Stripe era).
> Weedtip has since removed Stripe entirely — shoppers never pay through Weedtip, billing is
> sales-led B2B. That deployment is long done; this file is now the deals-engine hand-off.

---

## Where things stand (shipped this session — do NOT rebuild)

DB-driven brand settings (`platform_settings` + `/admin/settings`) · branded Supabase auth emails
(Send Email Hook — **needs the dashboard toggle, see docs/MANUAL-TASKS.md**) · plan-gating with
upgrade walls · **per-dispensary tax engine** · fulfillment v1 (order board, pause-orders toggle,
order detail + printable receipt) · in-app + email **notifications** (+ bell dropdown) ·
**GHL-style sub-account entitlements** (`/admin/dispensaries/[id]` Plan & features → per-feature
Force On/Off) · **team RBAC** (owner invites manager/staff; access delegated by extending
`owns_dispensary()`) · **analytics depth** (date range, WoW/MoM deltas, brand/category, CSV
reports) · QR SVG+themes · review filters.

Full detail is in the memory file `weedtip-project-state.md` (slices 1–11 + the E2E test gotchas).

**Persistent test accounts on prod** (password `E2eTest!2026`): `alwayzlegit+e2eowner@gmail.com`
(dispensary_owner), `+e2eshopper@gmail.com`, `+e2ebrand@gmail.com`. Delete when done:
`delete from auth.users where email like 'alwayzlegit+e2e%@gmail.com';`

---

## THIS SESSION'S JOB: ① Deals Engine + distinct Promo-Codes module

Weedtip already has a working deals system — `deals` table with kinds
(percentage / fixed_amount / price_target / spend_threshold / bogo), auto-apply + code-based,
targeting (menu/category/products), redemption tracking in `deal_redemptions`, and the discount
RPCs `compute_promo_discount` / `compute_auto_order_discount` / `compute_bogo_discount` consumed by
`create_order`. Owner UI: `app/dashboard/deals/*` (`upsertDeal`/`deleteDeal` in
`app/dashboard/actions.ts`), gated behind the `deals` feature (Growth). Promo codes today are just a
field on a deal.

**The gaps to close (from the pasted Weedmaps P0–P4 spec):**

1. **Redemption caps + audience (highest value).** Add to `deals`: `max_uses_per_customer int`,
   `max_total_uses int`, `audience text check in ('all','first_time','return')`. Enforce in the
   discount path: `compute_promo_discount` (and `create_order`'s redemption insert) must reject a
   code once the per-customer or total cap is hit, and honor audience (first-time = the buyer has 0
   prior non-cancelled orders at this shop; return = ≥1). Reuse `deal_redemptions` for the counts.
   *(Careful: `create_order` has been re-declared 3× this session — copy the current body from the
   latest migration and change only the discount/redemption block.)*

2. **Dedicated Promo-Codes management view** — `/dashboard/promo-codes`: a `<DataTable>` of
   code-based deals (Code / Deal name / Dates / Redemptions vs cap / Status), separate from the
   Deals overview. Add a "Promo codes" owner-nav item (Growth-gated via `getOwnerFeature('deals')`).

3. **Deal scheduling view** — a "Deals Schedule" tab showing upcoming / active / expired deals on a
   simple timeline (pure UI over existing `start_date`/`end_date`, no RPC change). Optional
   recurring (e.g. weekly) needs a schedule model + day-of-week check in the discount RPCs — defer
   unless time allows.

4. **Deal image picker** — `<ImagePicker>`: upload (PNG/JPG ≤7MB, ~16:9, ownership-confirm checkbox)
   OR select an existing gallery image, writing to `deals.image_url`. Mirror
   `components/dashboard/image-upload.tsx` (public bucket → public URL into a hidden field).

**Suggested order:** (2) + (4) are self-contained UI (low risk, ship first). (1) touches the
discount RPCs — do it carefully with a fresh migration + `execute_sql` verification like the tax
engine did. (3) last.

**Acceptance:** a promo code with a total cap stops applying after the cap; a first-time-only code
rejects a returning customer; the Promo-Codes view lists codes with live redemption counts; drafts
discard without persisting; everything stays behind the Growth gate + dark-theme tokens.

---

## After ① — the rest of the Weedmaps-parity roadmap (each its own session)

② **Listing-editor parity** — photo gallery manager (multi-upload + drag-reorder + delete; today
only logo/cover Replace), video-by-URL, history/audit log, rich-text description, special/holiday
hours, reviews AI-summary, pickup-profile toggles (accept-outside-hours already exists as
`accepting_orders`; add require-ID, mixed adult+medical cart, post-order message ≤250). Extends
`app/dashboard/listing` + `dispensaries` columns.
③ **Marketing-Spend report** (month filter) — extends `app/dashboard/analytics`.
④ **Multi-location** — org container + `<LocationSwitcher>`; scope every filter/report/team
assignment by location. Big.
⑤ **Expand RBAC to the 4-role matrix** — Admin / Campaign-Manager / Manager / Associate(menu-only)
+ org scoping. Extends `dispensary_members.role` + `lib/owner.ts`.
⑥ **Advertising** — Creative Library / Scheduler / Insights / Performance, mapped onto Weedtip's
**Promote** (reserve-then-confirm, NO auto-charge/stored-card).
⑦ **Delivery logistics** — out_for_delivery status, driver assignment, zones, live Mapbox map,
ready-ETA, auto-print. (Deferred from fulfillment v1.)

---

## Invariants (never violate)

- **Freemium:** Free = 0% commission forever; Growth = $99/mo. No Weedmaps-style required ad spend.
- **Dark theme + current IA** — additive modules using existing tokens, never a restyle.
- **Reserve-then-confirm billing** (human confirms; no stored card in-flow). Billing is sales-led;
  self-serve "buys" create PENDING records + email sales@weedtip.com; `/admin/billing` activates.
- **Shoppers NEVER pay through Weedtip** (pickup = at store, delivery = driver; 100% B2B revenue).
- **Invite-only** team onboarding; **hyphenated slugs** (underscores 404); every data view needs
  skeleton / empty / error states + a "Showing X–Y of N" pager.
- The spec's shared primitives (`<DataTable>`, `<StatusPill>`, `<FilterBar>`, `<Modal>`,
  `<SegmentedToggle>`, `<CharCountedField>`, `<Stepper>`, `<ImagePicker>`, `<EmptyState>`,
  `<LocationSwitcher>`) — build once, reuse. Extract from existing ad-hoc tables/badges as you go.

## Working conventions

- Supabase migrations: apply to prod via the MCP `apply_migration` (user pre-authorized additive
  migrations); keep the repo migration file identical. Update `packages/supabase/src/types/
  database.types.ts` by hand (Row/Insert/Update + any new RPC in the Functions map).
- Ship in verified slices: `pnpm --filter web exec tsc --noEmit` + `eslint` + `pnpm --filter web
  build`, then commit on a `claude/<slice>` branch, merge `--no-ff` to main, push (Vercel
  auto-deploys). The primary working dir is `Desktop/Weed Tip` but the LIVE repo is
  `Desktop/Weedtip-fresh` — always `cd` there.
- Testing as users: the preview pane is ~961px (below the `lg` 1024 breakpoint) and headless clicks
  often don't fire React onClick / Next server-action submits — verify write-flows via the RPCs /
  `execute_sql` with `set_config('request.jwt.claims', …)` instead (see memory for the pattern).

Outstanding manual task for the user: enable the auth-email Send Email Hook (docs/MANUAL-TASKS.md).
