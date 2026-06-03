-- Multi-dimensional dispensary reviews (Leafly-style): Quality / Service /
-- Atmosphere sub-ratings averaged into the overall rating, a verified-shopper
-- flag derived from orders, and an owner dispute flow.
set search_path = public;

alter table public.reviews
  add column if not exists quality smallint check (quality between 1 and 5),
  add column if not exists service smallint check (service between 1 and 5),
  add column if not exists atmosphere smallint check (atmosphere between 1 and 5),
  add column if not exists verified boolean not null default false,
  add column if not exists dispute_reason text,
  add column if not exists disputed_at timestamptz;

-- Per-dimension aggregates on the dispensary (alongside the existing rating_avg).
alter table public.dispensaries
  add column if not exists rating_quality numeric(2,1) not null default 0,
  add column if not exists rating_service numeric(2,1) not null default 0,
  add column if not exists rating_atmosphere numeric(2,1) not null default 0;

-- Recompute all aggregates for one dispensary (overall + three dimensions).
create or replace function public.recalc_dispensary_rating(target_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.dispensaries d
  set rating_avg = coalesce(
        (select round(avg(rating)::numeric, 1) from public.reviews where dispensary_id = target_id), 0),
      rating_count = (select count(*) from public.reviews where dispensary_id = target_id),
      rating_quality = coalesce(
        (select round(avg(quality)::numeric, 1) from public.reviews where dispensary_id = target_id and quality is not null), 0),
      rating_service = coalesce(
        (select round(avg(service)::numeric, 1) from public.reviews where dispensary_id = target_id and service is not null), 0),
      rating_atmosphere = coalesce(
        (select round(avg(atmosphere)::numeric, 1) from public.reviews where dispensary_id = target_id and atmosphere is not null), 0)
  where d.id = target_id;
$$;

-- Authoritatively set the verified-shopper flag from the orders table — never
-- trust a client-supplied value. A "verified shopper" has a real order at the shop.
create or replace function public.reviews_set_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.verified := exists (
    select 1 from public.orders o
    where o.user_id = new.user_id
      and o.dispensary_id = new.dispensary_id
      and (o.status in ('confirmed', 'ready', 'completed') or o.payment_status = 'paid')
  );
  return new;
end;
$$;

create trigger reviews_set_verified_trg
  before insert or update of user_id, dispensary_id on public.reviews
  for each row execute function public.reviews_set_verified();

-- Owner/admin dispute (and un-dispute) a review. Mirrors reply_to_review.
create or replace function public.dispute_review(p_review_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  clean text := nullif(btrim(p_reason), '');
begin
  select rv.id, rv.dispensary_id into r from public.reviews rv where rv.id = p_review_id;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if not public.owns_dispensary(r.dispensary_id) and not public.is_admin() then
    raise exception 'Only the dispensary owner can dispute this review' using errcode = '42501';
  end if;
  update public.reviews
    set dispute_reason = clean,
        disputed_at = case when clean is null then null else now() end
  where id = p_review_id;
end;
$$;
revoke all on function public.dispute_review(uuid, text) from public, anon;
grant execute on function public.dispute_review(uuid, text) to authenticated;

-- Backfill verified for existing reviews; refresh aggregates.
update public.reviews r
set verified = exists (
  select 1 from public.orders o
  where o.user_id = r.user_id and o.dispensary_id = r.dispensary_id
    and (o.status in ('confirmed','ready','completed') or o.payment_status = 'paid')
);
update public.dispensaries d set rating_quality = 0, rating_service = 0, rating_atmosphere = 0;
