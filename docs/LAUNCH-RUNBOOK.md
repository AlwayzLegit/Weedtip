# Launch runbook — owner action items

_Last updated: 2026-07-19. Everything code-side is merged to `main` and deployed;
all migrations are applied to production (`ggpnghpcclngqkyelkes`). What follows
is the ordered list of things **only you can do**, then the ongoing weekly
operating loop. Supersedes the launch sections of `MANUAL-TASKS.md`._

---

## Phase 1 — flip the switches (~30 min, one-time)

### 1. Branded auth emails (the one true blocker)
1. Supabase dashboard → **Authentication → Hooks → Send Email** → enable, type
   **HTTPS**, URL `https://www.weedtip.com/api/auth/send-email`.
2. Copy the signing secret into the Vercel env var **`SEND_EMAIL_HOOK_SECRET`**
   (Production) and redeploy.
3. Test with a password reset + a fresh signup.

### 2. Leaked-password protection
Supabase dashboard → **Authentication → Providers → Email** → enable
**Leaked password protection**. One toggle; no code involved.

### 3. Outreach sender (starts the revenue flywheel)
1. In Resend, verify a **dedicated subdomain** sender, e.g.
   `invites@hello.weedtip.com` (keeps cold-outreach reputation off the
   transactional domain).
2. Vercel env vars: **`OUTREACH_FROM_EMAIL`** (the address) and optionally
   **`OUTREACH_POSTAL_ADDRESS`** (CAN-SPAM footer). Redeploy.

### 4. Optional switches
- **AI review summaries**: paste your Anthropic key in `/admin/settings` →
  the feature activates site-wide instantly (no deploy). Clear the field to
  hide it again.
- **Local map testing**: add `NEXT_PUBLIC_MAPBOX_TOKEN` to
  `apps/web/.env.local` (prod already has it).

---

## Phase 2 — merchandise the site (~20 min, one-time)

### 5. House-fill the top markets
`/admin/ads-desk` → **House fills** → click **"Fill with house picks"** on the
A+/A regions. Each fill comps the region's best photo-backed shops into its
open featured/premium slots ($0, 30-day term, labeled **Featured** — never
"Sponsored"). A real paid claim automatically preempts a house fill.

> House fills expire after 30 days by design — re-fill from the desk until
> real advertisers take over. Once a region is ~half genuinely paid, stop
> filling it: empty slots become the sales pitch.

### 6. Click-verify the money path (admin-only, ~10 min)
- `/admin/ads-desk`: queue renders; do one house fill and see it on the city page.
- `/advertise/<a-region>`: rate card shows the step price; the copy notes the
  next spot costs more.
- Dashboard overview (as an owner account): the "Your area" ad card renders.

---

## Phase 3 — first outreach campaign

1. `/admin/outreach` → target states **OK** (574 shops, all warm public
   emails), label the wave (e.g. `ok-launch-1`), send batches of 50.
2. After 5+ days, hit **"Send due reminders"** (one reminder ever per shop).
3. Watch the campaign funnel table (sent → opened → claimed). When the copy is
   proven, expand: NM (294), MS (169), ME (159), AZ (148) — then enable
   **registry contacts** to unlock California (~1,520 shops, colder audience).

Every claim lands in `/admin/claims` with a verification-strength badge and a
"wants basic/growth" chip when they picked a paid tier; approving a paid pick
auto-creates the pending subscription in `/admin/billing`.

---

## Weekly operating loop
| Surface | What to do |
|---|---|
| `/admin/ads-desk` | Activate holds, resolve waitlists, offer renewals on expiring terms, re-fill house slots |
| `/admin/claims` | Approve/reject ownership claims (license match + document + email-domain signals shown) |
| `/admin/billing` | Activate pending plan subscriptions + placements once invoicing is set |
| `/admin/outreach` | Next invite batch + due reminders; watch per-campaign conversion |
| `/admin/ownership` | Tier/grandfather/transfer management |

---

## Blocked on externals (no action possible yet)
- **PaymentCloud gateway** — waiting on your rep; billing stays sales-led
  (reserve-then-confirm) until then, and the pending-record flows won't change.
- **POS OAuth** (Dutchie/Flowhub/Treez) — on hold per your call; feed-URL menu
  sync works today.
- **Live driver GPS map** — needs a driver-facing client to feed locations.
- **Flutter mobile app** — consumer app has drifted (dark theme, no deals/
  tiers/delivery statuses); needs a catch-up pass if mobile matters at launch.
