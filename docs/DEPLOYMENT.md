# Weedtip — Deployment Runbook (handoff)

This is an actionable runbook for taking Weedtip from the GitHub repo to production
on **cloud Supabase + Vercel**. It's written to be executed by an agent with
Supabase + Vercel MCP access (or by hand in the dashboards).

## Context & decisions (locked)

| Thing | Value |
|-------|-------|
| Repo | `github.com/AlwayzLegit/Weedtip` (branch `main`) |
| Supabase org | **Jetnine** — `yudbeimndtbvtgzotemm` |
| Supabase region | **US East (Virginia)** — `us-east-1` |
| Vercel team | **alwayzlegit's projects** — `team_di6oiEhCIT17lNXsonHt3mSc` |
| Seed prod data | **Yes** — seed the demo catalog (8 dispensaries, 40 products, 6 deals) |
| Package manager | `pnpm@9.15.4` (Turborepo monorepo) |
| Web app | `apps/web` (Next.js 15 App Router) |
| Migrations | 16 files in `packages/supabase/supabase/migrations/` (0001 → 0016) |

The app is built to **degrade gracefully**: without Mapbox/Stripe keys the map shows
a placeholder and checkout falls back to pay-at-dispensary. So you can ship first and
add those keys later.

---

## ✅ LIVE — production deployment (2026-06-02)

Weedtip is deployed and smoke-tested green. Live coordinates for future sessions:

| Thing | Value |
|-------|-------|
| Production URL | **https://weedtip-web.vercel.app** |
| Supabase project | `weedtip-prod` — ref **`ggpnghpcclngqkyelkes`** — `https://ggpnghpcclngqkyelkes.supabase.co` |
| Supabase org (actual) | **Weed Tip** — `qswbzagyhhprhubtbnzj` — region `us-east-1` |
| Vercel project | `weedtip-web` — `prj_A4mKkRrOnkI3OK2OSoMYTGNrr8Jh` — team `alwayzlegits-projects` (`team_di6oiEhCIT17lNXsonHt3mSc`) — Root Directory `apps/web`, region `iad1` |
| DB | 16 migrations applied · 14 tables · 7 enums · 3 public storage buckets · seed verified (8 dispensaries / 40 products / 6 deals / 8 categories / 51 regions) |
| Auth | email confirmation **OFF** (launch choice) · Site URL + `/auth/callback` redirect URLs set |
| First admin | `alwayzlegit@gmail.com` (promoted via SQL) |
| Vercel env set | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ **Org note:** the connected Supabase MCP token reaches only the **Weed Tip** org
> (`qswbzagyhhprhubtbnzj`), not the "Jetnine" org named in the locked table above —
> so production lives in Weed Tip.

**Not yet configured (optional, degrade gracefully):** `NEXT_PUBLIC_SITE_URL` (only needed
for Stripe redirect URLs), Stripe keys + webhook (Phase 3 — needs a cannabis-friendly
processor for real payments), `NEXT_PUBLIC_MAPBOX_TOKEN`, custom domain.

**Deployment gotchas hit this round (for next time):**
- The MCP `deploy_to_vercel` is a zero-arg "deploy current project" and the MCP can't set
  Root Directory / env vars — so the Vercel project was created + configured in the
  dashboard. The Vercel CLI needs a valid account token (`vcp_…`) to drive it headless.
- A deploy **builds fine without env vars** (Supabase-backed pages are dynamic, not run at
  build), then **500s at runtime** with `MIDDLEWARE_INVOCATION_FAILED` /
  `Missing required environment variable` because the middleware calls
  `getPublicSupabaseConfig()`. Fix: set the `NEXT_PUBLIC_*` vars and **redeploy**
  (env vars only apply to new builds).
- Promoting the first admin over the MCP connection is blocked by the
  `enforce_profile_role` trigger (`auth.uid()` is null → `is_admin()` false). Wrap the
  `update` in `begin; set local session_replication_role = replica; … commit;`.

---

## Phase 1 — Cloud Supabase

### 1.1 Create the project
- Org `yudbeimndtbvtgzotemm` (Jetnine), region `us-east-1`, name e.g. `weedtip-prod`.
- Generate a strong DB password and **save it** (needed for CLI `db push`).
- (MCP: `confirm_cost` → `create_project`. Wait until status is ACTIVE/healthy.)

### 1.2 Apply all 16 migrations (in order)
Two options — **CLI is easiest**:

```bash
cd packages/supabase
supabase link --project-ref <NEW_PROJECT_REF>   # needs SUPABASE_ACCESS_TOKEN + db password
supabase db push                                 # applies 0001 → 0016 in order
```

Or via MCP `apply_migration` once per file, in filename order (0001 first).

**Verify**: `select count(*) from information_schema.tables where table_schema='public';`
and that enums exist (`order_status`, `payment_status`, `dispensary_status`, `strain_type`, `discount_type`).

### 1.3 Create storage buckets  ⚠️ REQUIRED — migrations only create the *policies*
The RLS policies reference three **public** buckets that must exist:

```sql
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('dispensary-media', 'dispensary-media', true),
  ('product-images', 'product-images', true)
on conflict (id) do nothing;
```
(Migration `0010_storage_policies` already defines read/write RLS for these.)

### 1.4 Seed reference + demo data
Run the seed (idempotent; safe to re-run):

```bash
# CLI: db push already runs seed.sql if configured; otherwise:
psql "<DB_CONNECTION_STRING>" -f packages/supabase/supabase/seed.sql
```
Or paste `packages/supabase/supabase/seed.sql` into MCP `execute_sql`.

Seeds: 8 categories, 51 operating regions, 8 dispensaries (active), 40 products,
6 deals. (Strains + brands are seeded by migrations 0012/0014.)

**Verify**: `select count(*) from dispensaries;` → 8, `products` → 40, `deals` → 6.

### 1.5 Auth configuration (dashboard → Authentication → URL Configuration)
- **Site URL**: `https://<your-vercel-domain>` (set/refine after Phase 2).
- **Redirect URLs**: add `https://<your-vercel-domain>/auth/callback`
  and a preview wildcard `https://*-alwayzlegits-projects.vercel.app/auth/callback`.
- **Email confirmations**: ON (default). Cloud sends real confirmation emails.
- Configure SMTP (or use Supabase's built-in) so signup confirmation emails send.

### 1.6 Create the first admin
Signups default to `consumer`/`dispensary_owner`. To get an admin:
1. Sign up normally on the deployed site with your admin email.
2. Promote in SQL:
   ```sql
   update public.profiles set role='admin'
   where id = (select id from auth.users where email='YOUR_ADMIN_EMAIL');
   ```

### 1.7 Collect keys for Vercel
- `NEXT_PUBLIC_SUPABASE_URL` → project URL (MCP `get_project_url`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon/publishable key (MCP `get_publishable_keys`).
- `SUPABASE_SERVICE_ROLE_KEY` → **service-role secret** (dashboard → Project Settings → API). Server-only; bypasses RLS (used by the Stripe webhook).

---

## Phase 2 — Vercel (deploy `apps/web`)

### 2.1 Create the project
- Import `github.com/AlwayzLegit/Weedtip` into team `alwayzlegits-projects`.
- **Root Directory**: `apps/web`  ← important (monorepo).
- **Framework Preset**: Next.js.
- Install/Build/Output: leave **defaults**. Vercel detects `pnpm-workspace.yaml` at the
  repo root and installs the whole workspace; `apps/web/next.config` uses
  `transpilePackages` for `@weedtip/shared` + `@weedtip/supabase`, so no separate
  package build step is needed. Node version follows the repo `.nvmrc`; pnpm via corepack.

### 2.2 Environment variables (Production + Preview)

| Variable | Required | Value |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | From 1.7 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | From 1.7 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | From 1.7 (server-only — do NOT prefix NEXT_PUBLIC) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://<your-vercel-domain>` (used for Stripe redirect URLs) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | optional | Mapbox public token (`pk.…`). Omit → map placeholder. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | optional | Stripe `pk_…`. Omit → pay-at-dispensary only. |
| `STRIPE_SECRET_KEY` | optional | Stripe `sk_…` (server-only) |
| `STRIPE_WEBHOOK_SECRET` | optional | Stripe `whsec_…` (set in Phase 3) |

### 2.3 Deploy
- Trigger the deploy; wait for build success.
- Copy the production domain → set `NEXT_PUBLIC_SITE_URL` to it and update the Supabase
  Site URL / redirect URLs (1.5), then redeploy so the value bakes in.

---

## Phase 3 — Stripe (when you have keys; otherwise skip — checkout still works as pay-at-dispensary)

1. Add `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to Vercel env (use
   `sk_live_`/`pk_live_` for real, or `sk_test_`/`pk_test_` to validate first).
2. Stripe Dashboard → Developers → **Webhooks** → Add endpoint:
   - URL: `https://<your-vercel-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `charge.refunded`
3. Copy the signing secret (`whsec_…`) → Vercel env `STRIPE_WEBHOOK_SECRET` → **redeploy**.
4. Test: check out with **Pay now**, card `4242 4242 4242 4242` → after payment the
   webhook flips the order to **paid + confirmed** (visible on the order page).
   ⚠️ Compliance note: Stripe prohibits cannabis sales on its standard product — for a
   real launch you need a cannabis-friendly processor; the integration is processor-shaped
   and can be swapped.

---

## Phase 4 — Smoke test (post-deploy)

- `/` loads (hero, category pills with icons, featured dispensaries).
- `/dispensaries` shows 8 shops; a detail page shows its menu grouped by category.
- `/products` shows 40 (paginated); `/strains`, `/brands`, `/deals` populate.
- Sign up → confirm email → sign in. Promote yourself to admin (1.6).
- Admin: `/admin` overview, `/admin/dispensaries` moderation controls.
- Owner: "List your dispensary" → create listing → it's `pending` → approve in admin → it goes public.
- Cart → checkout: order is created; payment badge reflects pay-at-pickup (or Paid if Stripe live).
- `/api/stripe/webhook` (POST) returns `503` until Stripe is configured, then `400` without a valid signature — both expected.

---

## Gotchas / things the codebase already handles (don't "fix" these)

- **`enforce_dispensary_admin_fields`** trigger fires on **UPDATE only** — only admins can
  change `status`/`featured`. Seeded dispensaries set these on INSERT (so seed works). For
  manual DB edits as `postgres`, wrap in `begin; set local session_replication_role=replica; … commit;`.
- **`search_vector`** on dispensaries/products is a **generated column** (auto-populates) —
  no trigger to run after seeding.
- **Storage buckets are not created by migrations** — see 1.3 (easy to miss).
- **Seed images are intentionally null** — listings/products show a branded leaf
  placeholder; real photos are uploaded by owners via the dashboard (→ Supabase Storage,
  which is the only host on the `next/image` allowlist, `*.supabase.co`).
- **Server-authoritative pricing**: orders/totals come from the `create_order` RPC and the
  Stripe session is built from the DB snapshot — never trust client cart prices.
- **CSS-uppercased headings** (FLOWER/VAPES/HOURS…) read as lowercase in raw HTML — not a bug.
- `.env*` is gitignored (except `.env.example`); never commit real keys.

## Env var reference for local dev
Copy `.env.example` → `apps/web/.env.local` and fill in. The same variable names are used
in Vercel. `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_*` (except the `NEXT_PUBLIC_` ones) are
server-only.
