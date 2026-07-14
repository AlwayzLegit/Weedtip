# Monetization audit — findings & remediation status

Adversarial audit (7 surface auditors → verification → synthesis), July 2026.
27 findings confirmed. This tracks what's fixed vs outstanding.

## Assessment

The sales-led model was sound on paper but enforced almost entirely in app
code while the database said otherwise: brand bids defaulted to `active`, the
subscriptions CHECK didn't allow `pending`, placements encoded "pending" as an
ambiguous boolean+null, and `create_order` still charged 5%. The two most
valuable paid perks could be self-granted for free while the one
recurring-revenue flow (Growth) failed 100% of the time in prod.

**Structural gap the findings circle but never name:** there is no invoice /
payment ledger anywhere. No table records what was quoted, invoiced, or paid
for any pending record, activation has no money trail, and the pending→active
state machine is re-implemented differently for each of the four product
types. A unified `invoices` / `billing_events` table should be designed
alongside the PaymentCloud work so activation reconciles against something.

## ✅ Fixed (commits de65f3b, d58a050) — code on `claude/monetization-overhaul`

Lifecycle (earlier commit de65f3b): POS grant used the wrong client (never
granted); no plan renewal (evergreen now); 30-min slot release (→ 7 days,
applied to prod); POS not revoked on reject; silent ad activation; slot
squatting cap; per-user rate limits.

Integrity (commit d58a050):
- Brand-bid self-activation — revoked + default pending; dead action deleted.
- `is_paid_listing` requires a paid plan.
- `pending` allowed in the subscriptions CHECK.
- `create_order` permanent 0% commission + backfill.
- `placements.status` column; billing/promotions consoles de-collided.
- POS grant price-based (works pre- and post-reset).
- `requestPlanChange` never demotes an active paid subscriber.
- Ad-metric RPCs revoked from anon; beacon routes rate-limited via service client.
- Paid featured slots labeled "Sponsored" (FTC).

## ⚠️ Requires prod apply (auto-mode blocked — run these)

Three migrations are committed but must be applied to prod (in order) and
should ship in the SAME window as the code deploy — prod drift (code
outrunning migrations) is itself a confirmed finding:

1. `20260713150000_retire_stripe_pricing_reset.sql` — the pricing reset
   (still pending your original approval; plus→growth, drops stripe columns).
2. `20260714090000_monetization_integrity.sql` — the integrity cluster above.
3. `20260714091000_lock_ad_metrics.sql` — revoke anon metric grants.

Plus one **ops SQL** (not a migration — local seeds legitimately keep the row):
```sql
delete from public.dispensaries
where id = 'a1000000-0000-4000-8000-000000000001';  -- demo 'Green Leaf NYC'
```
This demo listing is live in the prod directory with a fabricated menu, deals,
and a review — currently the only shop with products, so it dominates results.
FKs cascade its products/deals. `refresh-ca-data.sh` already reserves the slug.

## ⏳ Outstanding — Harden (this week)

- **Region ad slots under-deliver (HIGH, real feature work):** paid slot
  treatment (rank, badge, beacons) lives only in the city page's first ISR
  paint. It vanishes on the first map/filter interaction, and `/dispensaries`
  / state / home pages never render slot buyers at all — because
  `search_dispensaries_bounds` only knows the legacy free `featured` flag.
  Fix: thread the slot sets into `dispensaries-browser.tsx` and re-apply after
  each client re-query; make `/dispensaries` slot-aware server-side. Scoped as
  its own change — it's a build, not a patch.
- Non-zero brand-region floors (`featured_rate_cents > 0` CHECK + re-check at activation).
- Tagged-cache revalidation on ad activate/cancel (`revalidateTag('region-placements:<id>')`).
- Order-creation throttle per-user AND per-dispensary (in-RPC guard, since create_order is PostgREST-callable).
- HTML-escape business-controlled names in sales/ops emails.
- Deal redemption caps (`max_redemptions` / `per_user_limit`); stop counting AUTO/cancelled as redemptions.
- Deterministic featured-slot rotation (replace the biased frozen shuffle).

## ⏳ Outstanding — Gateway era (with PaymentCloud)

- Webhook activation pipeline replacing email-and-human as the trigger; add a
  `paid_at` / `payment_ref` trail and the unified invoice ledger above.
- Payment-driven hold release + real subscription terms (retire cron-only lifecycle).
- Interim, cheap: surface the four pending-billing counts on the /admin overview.
