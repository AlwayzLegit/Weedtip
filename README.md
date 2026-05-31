# Weedtip

> The Google Maps of cannabis. Discover dispensaries, browse menus, read reviews, find deals, and order for pickup or delivery — scoped to your location.

A cannabis dispensary discovery and ordering marketplace. Consumers (21+) find legal
dispensaries near them; dispensary owners manage their storefront, menu, and orders;
platform admins keep the marketplace healthy.

## Monorepo layout

```
weedtip/
├── apps/
│   ├── web/            # Next.js 15 (App Router) + React + TypeScript + Tailwind
│   └── mobile/         # Flutter (iOS + Android)
├── packages/
│   ├── shared/         # Shared TS types, Zod validators, constants (domain source of truth)
│   └── supabase/       # Supabase client config, typed queries, SQL migrations, RLS
├── turbo.json          # Turborepo pipeline
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Tech stack

| Layer        | Technology                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Web frontend | Next.js 15 (App Router), React, TypeScript, Tailwind CSS                                            |
| Mobile       | Flutter (single codebase → iOS + Android)                                                           |
| Backend / DB | Supabase — Postgres + PostGIS, Auth, RLS, Edge Functions, Realtime, Storage                         |
| Search       | Postgres FTS + PostGIS (abstracted behind a search interface — swappable for Typesense/Meilisearch) |
| Maps         | Mapbox (frontend rendering) + PostGIS (backend geo logic)                                           |
| Payments     | Stripe (placeholder — compliance handled separately)                                                |
| Hosting / CI | Vercel + GitHub Actions                                                                             |

## Prerequisites

- Node.js ≥ 20 (`.nvmrc` pins 20)
- pnpm ≥ 9 (`corepack enable` then `corepack prepare pnpm@9.15.4 --activate`)
- Supabase CLI (`npm i -g supabase`) for local DB / migrations
- Flutter SDK (mobile only)

## Getting started

```bash
pnpm install
cp .env.example .env            # fill in Supabase + Mapbox keys

# Database (local Supabase stack via Docker)
supabase start                  # from packages/supabase
pnpm db:reset                   # apply all migrations + seed
pnpm db:types                   # regenerate TypeScript types from the live schema

# Run everything
pnpm dev                        # turbo runs web (+ any other dev tasks)
```

## Database

The schema is the source of truth and lives in
[`packages/supabase/migrations`](packages/supabase/migrations). Migrations are applied in
filename order. See the [package README](packages/supabase/README.md) for the table map,
RLS model, and search architecture.

Key principles enforced from day one:

1. **Schema first** — get the data model right before UI.
2. **Type safety everywhere** — generated DB types flow into `@weedtip/supabase` and
   `@weedtip/shared`, shared across web and mobile.
3. **RLS from day one** — access control lives in the database, never frontend-only.
4. **Compliance-aware** — age-gating, location verification, and regional legality are
   modeled in the schema, not bolted on.

## Scripts

| Command          | Description                                   |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Run all dev servers (Turborepo)               |
| `pnpm build`     | Build all apps and packages                   |
| `pnpm lint`      | Lint the workspace                            |
| `pnpm typecheck` | Type-check the workspace                      |
| `pnpm format`    | Prettier write                                |
| `pnpm db:types`  | Regenerate Supabase TypeScript types          |
| `pnpm db:reset`  | Reset local DB and re-apply migrations + seed |
