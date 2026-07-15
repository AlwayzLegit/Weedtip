-- ════════════════════════════════════════════════════════════════════════════
-- 20260715140000_platform_settings
--
-- Single source of truth for brand + contact facts that were previously
-- hardcoded and duplicated across lib/email.ts, footer.tsx, seo.ts, and every
-- legal page (name, address, phone, the support/sales/ads/privacy inboxes, the
-- brand color). One editable row so emails, the footer, structured data, and the
-- legal pages all read the same live values — change them once in /admin/settings.
--
-- Single-row by construction (id is fixed to 1). Public-read so the footer +
-- JSON-LD can render them; admin-only write.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_settings (
  id                 int primary key default 1,
  brand_name         text not null default 'Weedtip',
  legal_name         text,
  tagline            text,
  -- Contact inboxes (kept distinct so we can route mail by purpose).
  support_email      text not null default 'support@weedtip.com',
  sales_email        text not null default 'sales@weedtip.com',
  ads_email          text not null default 'ads@weedtip.com',
  privacy_email      text not null default 'privacy@weedtip.com',
  -- The "From" identity for transactional + auth email.
  email_from         text not null default 'Weedtip <notifications@weedtip.com>',
  -- Phone: display form + tel: (E.164) form.
  phone_display      text,
  phone_e164         text,
  -- Physical address (also feeds LocalBusiness/Organization structured data).
  address_line       text,
  address_locality   text,
  address_region     text,
  postal_code        text,
  country            text not null default 'US',
  -- Brand color used in email templates + anywhere a single accent is needed.
  brand_color        text not null default '#1a7f4e',
  updated_at         timestamptz not null default now(),
  constraint platform_settings_singleton check (id = 1)
);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

-- Brand/contact facts are public info (they render in the footer + JSON-LD).
drop policy if exists platform_settings_select_public on public.platform_settings;
create policy platform_settings_select_public on public.platform_settings
  for select to anon, authenticated using (true);

drop policy if exists platform_settings_write_admin on public.platform_settings;
create policy platform_settings_write_admin on public.platform_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed the one row with the values that were previously hardcoded.
insert into public.platform_settings (
  id, brand_name, legal_name, tagline,
  support_email, sales_email, ads_email, privacy_email, email_from,
  phone_display, phone_e164,
  address_line, address_locality, address_region, postal_code, country,
  brand_color
) values (
  1, 'Weedtip', 'Weedtip', 'The Google Maps of cannabis',
  'support@weedtip.com', 'sales@weedtip.com', 'ads@weedtip.com', 'privacy@weedtip.com',
  'Weedtip <notifications@weedtip.com>',
  '(747) 250-4446', '+17472504446',
  'North Hollywood, CA 91606', 'North Hollywood', 'CA', '91606', 'US',
  '#1a7f4e'
) on conflict (id) do nothing;
