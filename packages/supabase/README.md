# @weedtip/supabase

Typed Supabase access + the database schema (migrations, RLS, search) for Weedtip.

## Layout

```
packages/supabase/
├── supabase/
│   ├── config.toml              # Local stack config (ports, storage buckets, auth)
│   ├── seed.sql                 # Reference data (categories, regional legality)
│   └── migrations/
│       ├── …_extensions_and_enums.sql
│       ├── …_core_tables.sql
│       ├── …_indexes.sql
│       ├── …_functions_and_triggers.sql
│       ├── …_search.sql
│       └── …_rls.sql
└── src/
    ├── client.ts                # Browser client (anon, RLS)
    ├── server.ts                # SSR client (cookie adapter) + admin client (service role)
    ├── config.ts                # Env resolution
    ├── queries.ts               # Typed query/RPC helpers (the swappable search seam)
    └── types/database.types.ts  # Generated DB types (pnpm db:types)
```

## Commands (run from this package)

```bash
pnpm db:start    # supabase start  — boots local Postgres/Auth/Storage (Docker)
pnpm db:reset    # supabase db reset — drops, replays all migrations, runs seed.sql
pnpm db:diff     # supabase db diff — generate a migration from schema drift
pnpm db:push     # supabase db push — apply migrations to the linked remote project
pnpm gen:types   # regenerate src/types/database.types.ts from the local schema
```

## Schema at a glance

| Table               | Purpose                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `profiles`          | Extends `auth.users` 1:1. Role + age-gate DOB. Auto-created on signup. |
| `dispensaries`      | Listings with PostGIS `location`, hours JSONB, status, featured flag.  |
| `categories`        | Product taxonomy (seeded).                                             |
| `products`          | Menu items per dispensary, with strain/THC/CBD/price.                  |
| `deals`             | Time-bounded promotions per dispensary.                                |
| `reviews`           | 1–5 ratings, one per user per dispensary.                              |
| `favorites`         | User ↔ dispensary bookmarks (composite PK).                            |
| `orders`            | Pickup/delivery orders with a JSONB line-item snapshot.                |
| `operating_regions` | Per-state legality + minimum age (compliance gating).                  |

## RLS model

RLS is enabled on **every** table. Access is decided in the database, never the client.

- **Public (anon + authenticated):** active dispensaries, their products & deals, all
  categories, reviews, operating regions.
- **Consumers:** own profile & favorites; create/edit own reviews; place/cancel own orders.
- **Dispensary owners:** full CRUD on their own dispensary, products, deals; read & update
  their dispensary's orders. `status` and `featured` are admin-only (trigger-enforced).
- **Admins:** everything.

Policy predicates use SECURITY DEFINER helpers (`is_admin()`, `auth_role()`,
`owns_dispensary()`) that read base tables without recursing through RLS. Two guard
triggers prevent privilege/marketplace tampering: self role-escalation on `profiles`,
and owner edits to `status`/`featured` on `dispensaries`.

## Search architecture (swappable)

Search runs through two RPCs — `search_dispensaries` (FTS + PostGIS distance ranking)
and `search_products` (FTS + category/strain/price filters). Callers use the typed
helpers in `queries.ts`, whose inputs/outputs match the `@weedtip/shared` search
schemas. To migrate to Typesense/Meilisearch later, reimplement those helpers (or the
`search-dispensaries` Edge Function) against the new backend — **callers don't change.**

Generated columns (`search_vector`) keep FTS indexes current automatically; GiST indexes
back geo queries; `pg_trgm` GIN indexes back fuzzy name matching for autocomplete.
