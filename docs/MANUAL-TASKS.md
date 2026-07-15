# Manual tasks — owner action items

Everything built this session is merged to `main` and deployed, and all database
migrations are applied to production (`ggpnghpcclngqkyelkes`). The items below are
the things **only you can do** (dashboard toggles, secrets, external config) plus
recommended verification.

---

## 1. Activate branded auth emails  ⬅ only true blocker

The endpoint + templates are live; they just need Supabase pointed at them.

1. Supabase dashboard → **Authentication → Hooks → Send Email** → enable, type
   **HTTPS**, URL: `https://www.weedtip.com/api/auth/send-email`.
2. Supabase shows a signing secret (`v1,whsec_…`). Copy it into a Vercel env var
   **`SEND_EMAIL_HOOK_SECRET`** (Production).
3. **Redeploy** the Vercel app so it picks up the env var.
4. Test: trigger a **password reset** and a **new signup**; confirm the branded
   emails arrive.
5. Safety: if they DON'T arrive, **disable the hook** (Supabase falls back to its
   default emails automatically) and let me know — a misconfigured hook is the
   only way this could interrupt auth email.

> `RESEND_API_KEY` must be present (it is). The hook makes Supabase delegate ALL
> auth email to our Resend-based endpoint.

---

## 2. Confirm env vars in Vercel (Production)

Most are already set (the app is live). Confirm these exist:

- **`SEND_EMAIL_HOOK_SECRET`** — new, from task 1.
- **`SUPABASE_SERVICE_ROLE_KEY`** — required by notifications + billing (already
  set, since billing works; just confirm).
- **`RESEND_API_KEY`** — transactional + auth email (set).
- **`GOOGLE_PLACES_API_KEY`** — needed for live storefront cover/photo images in
  prod. If shop photos aren't loading, this is why.
- **`NEXT_PUBLIC_SITE_URL`** = `https://www.weedtip.com`.
- Baseline (should already be set): `NEXT_PUBLIC_SUPABASE_URL`,
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (rate limiting),
  `NEXT_PUBLIC_MAPBOX_TOKEN` (maps), `CRON_SECRET` (cron routes).
- Optional overrides: `EMAIL_FROM`, `SALES_EMAIL` (otherwise the DB
  platform_settings defaults are used).

---

## 3. Review platform settings

Visit **`/admin/settings`** and confirm the brand name, legal name, tagline,
address, phone, and the support/sales/ads/privacy inboxes. These now drive the
site footer, all emails, Organization JSON-LD, and the legal pages. They're
seeded with the current values — edit anything that's wrong.

---

## 4. Verify the new features on live (quick smoke tests)

- **Plan gating:** as a free dispensary owner, deals/promos/updates/taxes should
  show the "upgrade to Growth" wall. Activate Growth (or use the admin override in
  task below) and confirm they unlock.
- **Sub-account console:** `/admin/dispensaries/<id>` → "Plan & features" → set a
  feature to **Force on / Force off** and confirm it takes effect for that shop.
- **Team RBAC:** at `/dashboard/team` invite a second email as staff; sign in with
  that account, accept at `/invites`, confirm they can manage the menu but see no
  billing/team/promote nav.
- **Notifications:** as admin, confirm the bell shows a notification on a new
  claim / new listing / billing request; as an owner, on an approval.
- **Fulfillment:** on `/dashboard/orders` hit **Pause orders** and confirm
  checkout is blocked for shoppers; open an order's **Details** and **Print**.

---

## 5. Pre-existing / optional

- **CA data refresh cron** — `.github/workflows/refresh-ca-data.yml` (monthly
  DCC re-sync) still needs to be added to the GitHub repo manually; the git token
  used lacked the GitHub `workflow` OAuth scope. It needs repo secrets
  `SUPABASE_DB_URL` / `SUPABASE_URL` / `SUPABASE_ANON_KEY`. Optional — only affects
  keeping California listing data fresh.

---

## Not your task (mine, still queued)

Analytics depth, listing-editor parity (rich text / holiday hours / photo
gallery / age-gate), promo-code + deal scheduling + QR/reviews polish, and
delivery logistics (out-for-delivery, driver map, zones) remain on the roadmap.
