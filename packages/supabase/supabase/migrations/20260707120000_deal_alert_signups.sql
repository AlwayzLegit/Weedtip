-- Deal-alert email capture. Converts anonymous browsers into a reachable
-- audience — the site's first owned marketing channel. Anyone (including
-- signed-out visitors) may subscribe; only admins can read the list back.

create table public.deal_alert_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Optional target market so alerts can be scoped to the visitor's state.
  state text,
  -- Where the signup happened (footer, homepage band, deal page…).
  source text,
  created_at timestamptz not null default now()
);

-- One row per email+state; a repeat submit is a no-op (see ON CONFLICT in the
-- server action). NULL state uses a sentinel so the unique index still applies.
create unique index deal_alert_signups_email_state_key
  on public.deal_alert_signups (lower(email), coalesce(state, ''));

alter table public.deal_alert_signups enable row level security;

-- Public signup: anyone may insert their own email.
create policy deal_alert_signups_insert_public on public.deal_alert_signups
  for insert to anon, authenticated with check (true);

-- The list is private — only admins can read it.
create policy deal_alert_signups_select_admin on public.deal_alert_signups
  for select to authenticated using (public.is_admin());
