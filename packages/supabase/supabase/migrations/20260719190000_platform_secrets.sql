-- ════════════════════════════════════════════════════════════════════════════
-- 20260719190000_platform_secrets
-- Server-side secrets set from the super-admin console (e.g. the Anthropic API
-- key that switches on AI review summaries). Unlike platform_settings this is
-- NOT public-read: only admins can see or write rows; the app reads them
-- server-side with the service client. Values never reach the client.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.platform_secrets (
  name       text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_secrets enable row level security;

drop policy if exists platform_secrets_admin on public.platform_secrets;
create policy platform_secrets_admin on public.platform_secrets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
