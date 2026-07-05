-- ════════════════════════════════════════════════════════════════════════════
-- 20260705010000_claim_v2_google_sync
-- Claim process v2 (Weedmaps-style structured verification) + Google sync
-- bookkeeping.
--
-- • ownership_requests gains the claimant's role at the business and business
--   contact details, plus a license_match flag computed server-side when the
--   entered license matches the state record — the strongest self-serve signal
--   an admin has when reviewing.
-- • Admins are notified in-app the moment a claim lands (audit: a claim sat
--   pending for 31 days with no signal).
-- • dispensaries.last_google_sync records when a listing last imported its
--   hours/phone/website from its linked Google Business Profile.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.ownership_requests
  add column if not exists claimant_role text
    check (claimant_role is null or claimant_role in ('owner', 'manager', 'authorized_rep')),
  add column if not exists business_email text
    check (business_email is null or char_length(business_email) <= 254),
  add column if not exists business_phone text
    check (business_phone is null or char_length(business_phone) <= 30),
  add column if not exists license_match boolean not null default false;

alter table public.dispensaries
  add column if not exists last_google_sync timestamptz;

-- In-app notification to every admin when a new claim (dispensary or brand)
-- is submitted.
create or replace function public.notify_admins_new_claim()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if tg_table_name = 'ownership_requests' then
    select name into v_name from public.dispensaries where id = new.dispensary_id;
    insert into public.notifications (user_id, type, title, body, data)
    select p.id, 'claim', 'New dispensary claim',
           coalesce(v_name, 'A listing') || ' has a new ownership claim to review.',
           jsonb_build_object('kind', 'dispensary', 'request_id', new.id, 'dispensary_id', new.dispensary_id)
    from public.profiles p where p.role = 'admin';
  else
    select name into v_name from public.brands where id = new.brand_id;
    insert into public.notifications (user_id, type, title, body, data)
    select p.id, 'claim', 'New brand claim',
           coalesce(v_name, 'A brand') || ' has a new ownership claim to review.',
           jsonb_build_object('kind', 'brand', 'claim_id', new.id, 'brand_id', new.brand_id)
    from public.profiles p where p.role = 'admin';
  end if;
  return new;
end; $$;

drop trigger if exists ownership_requests_notify_admins on public.ownership_requests;
create trigger ownership_requests_notify_admins
  after insert on public.ownership_requests
  for each row execute function public.notify_admins_new_claim();

drop trigger if exists brand_claims_notify_admins on public.brand_claims;
create trigger brand_claims_notify_admins
  after insert on public.brand_claims
  for each row execute function public.notify_admins_new_claim();
