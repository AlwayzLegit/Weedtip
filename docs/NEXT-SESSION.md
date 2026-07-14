> **Historical note (July 2026):** Stripe has since been removed entirely — Weedtip never charges shoppers (pay at store / pay the delivery partner) and B2B billing is sales-led via /admin/billing pending the PaymentCloud gateway. Stripe references below are obsolete.

# Weedtip — Next Session Kickoff (Deployment)

> Paste-ready briefing for the session where the agent has **direct Supabase + Vercel
> MCP access** and will take Weedtip live. Pair this with the step-by-step
> **`docs/DEPLOYMENT.md`** runbook (this file is the "who/what/why"; that file is the "how").

---

## Your mission this session
Provision production infra and **deploy Weedtip end-to-end**: cloud Supabase →
migrations + storage buckets + seed → Vercel deploy of `apps/web` → (optional) Stripe
webhook → smoke test a live URL. Execute `docs/DEPLOYMENT.md` phase by phase.

## What Weedtip is
A cannabis dispensary discovery + ordering marketplace (Weedmaps-style). Stack:
Next.js 15 App Router (web), Supabase (Postgres + PostGIS, Auth, RLS, Storage), Turborepo
+ pnpm monorepo, Flutter mobile (not part of this deploy). Three sides: **consumer**
storefront, **owner** dashboard, **admin** moderation. Age-gated, RLS from day one,
server-authoritative order pricing, Stripe Checkout with a pay-at-dispensary fallback.

## Current state (all done & QA'd)
- **Code is on GitHub: `github.com/AlwayzLegit/Weedtip`, branch `main`, HEAD `52aee29`.**
  `gh` is authed as `AlwayzLegit`. Nothing to push first — deploy from `main`.
- Fully built & tested locally: storefront, owner CRUD, admin moderation/approval,
  Stripe checkout (fallback verified; live path needs keys), reproducible seed catalog
  (8 dispensaries / 40 products / 6 deals), 16 migrations (0001–0016).
- A local Supabase Docker stack is running (Studio :55525, API :55521, DB :55522) — that's
  **local only**; production is a fresh cloud project.
- Detailed project history + gotchas live in this session's auto-memory:
  `~/.claude/projects/C--Users-jetni-Desktop-Weed-Tip/memory/weedtip-project-state.md`.
  Read it for full context.

## Locked decisions (don't re-ask)
| | |
|---|---|
| Supabase org | **Jetnine** — `yudbeimndtbvtgzotemm` |
| Supabase region | **US East** — `us-east-1` |
| Vercel team | **alwayzlegit's projects** — `team_di6oiEhCIT17lNXsonHt3mSc` |
| Seed demo data in prod | **Yes** |
| Deploy target | `apps/web` (Root Directory in Vercel) |

Both **Supabase MCP** (Jetnine org) and **Vercel MCP** (alwayzlegit's projects) were
confirmed connected in the prior session.

## Confirm with me (the user) early — these need my input/choices
1. **Supabase project name** (suggest `weedtip-prod`) and **DB password** — generate a
   strong one and show it to me to save (needed for CLI `db push`).
2. **Auth email strategy**: cloud email confirmation is ON by default and needs working
   SMTP to send. Either (a) I provide SMTP creds, or (b) temporarily disable email
   confirmation for launch, or (c) use Supabase's default sender. Pick before sign-up testing.
3. **First admin email** — which email to sign up + promote to `admin` (via SQL).
4. **Custom domain?** — or just use the `*.vercel.app` URL for now.
5. **Stripe / Mapbox keys** — have them now, or ship with graceful fallback and add later?
   (No keys → map placeholder + pay-at-dispensary; both fully functional.)

## Order of operations (see DEPLOYMENT.md for exact commands)
1. **Supabase**: create project → apply 16 migrations (CLI `supabase db push` is easiest)
   → **create 3 storage buckets** `avatars` / `dispensary-media` / `product-images`
   (⚠️ migrations only create their policies, not the buckets) → run `seed.sql` →
   set Auth Site URL + redirect URLs → collect URL/anon/service-role keys.
2. **Vercel**: import the repo, **Root Directory = `apps/web`**, framework Next.js,
   defaults otherwise; set env vars (table in DEPLOYMENT.md) → deploy → set
   `NEXT_PUBLIC_SITE_URL` to the deployed domain → redeploy.
3. **First admin**: sign up on the live site → `update public.profiles set role='admin' …`.
4. **Stripe** (optional): add keys → create webhook `…/api/stripe/webhook`
   (events `checkout.session.completed`, `charge.refunded`) → set `STRIPE_WEBHOOK_SECRET` → redeploy.
5. **Smoke test**: home, /dispensaries (8), a detail menu, /products (40), admin overview,
   owner list→pending→approve→public, cart→checkout. Webhook POST returns 503 until Stripe configured.

## Don't "fix" these (intended behavior)
- `enforce_dispensary_admin_fields` fires on **UPDATE only** (admins set status/featured).
  Seed sets them on INSERT, so seeding works.
- `search_vector` is a **generated column** (auto-fills) — no post-seed reindex needed.
- **Storage buckets aren't created by migrations** — create them (step 1).
- **Seed images are null on purpose** → branded leaf placeholder; owners upload real
  photos via the dashboard (Supabase Storage; `*.supabase.co` is the only next/image host).
- Local test users (`admin/owner/shopper@weedtip.test`) are **local only** — prod starts
  with no users; create the admin per step 3.
- Stripe forbids cannabis on its standard product — fine for demo/test; a real launch
  needs a cannabis-friendly processor (integration is swappable).

## Definition of done
A live Vercel URL where: the storefront browses the seeded catalog, a user can sign up /
sign in, an owner can list a dispensary and an admin can approve it live, and checkout
creates an order (paid via Stripe if keys are set, else pay-at-dispensary).

---
**Start by reading `docs/DEPLOYMENT.md`, then confirm the 5 items above with me and begin Phase 1.**
