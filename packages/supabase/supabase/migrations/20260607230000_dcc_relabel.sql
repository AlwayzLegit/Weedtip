-- ════════════════════════════════════════════════════════════════════════════
-- 20260607230000_dcc_relabel
-- The phone/email/name imported from the DCC license record are the licensee /
-- registered-agent contacts and the registered business name — NOT the public
-- storefront's. Separate them: keep `name` as the display name, add `legal_name`
-- for the registered entity, and move the DCC contacts into `dcc_phone`/
-- `dcc_email`. The public `phone`/`email` are then sourced from enrichment
-- (OpenStreetMap) or the owner on claim. Claimed/demo listings (owner_id set)
-- keep their owner-entered public contacts untouched.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

alter table public.dispensaries
  add column if not exists legal_name text,
  add column if not exists dcc_phone text,
  add column if not exists dcc_email text;

comment on column public.dispensaries.legal_name is
  'Registered legal/business name from the DCC license; the public display name is `name`.';
comment on column public.dispensaries.dcc_phone is
  'Phone from the DCC license (licensee/registered agent), not the public storefront line.';
comment on column public.dispensaries.dcc_email is
  'Email from the DCC license (licensee/registered agent), not a public storefront address.';

-- Move DCC-sourced contacts on unclaimed seed rows into the dcc_* fields and
-- clear the public phone/email (filled later by enrichment / owner claim).
update public.dispensaries
  set dcc_phone = phone, dcc_email = email
  where owner_id is null and (phone is not null or email is not null);

update public.dispensaries
  set phone = null, email = null
  where owner_id is null;
