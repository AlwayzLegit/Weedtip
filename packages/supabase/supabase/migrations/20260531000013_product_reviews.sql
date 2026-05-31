-- ════════════════════════════════════════════════════════════════════════════
-- 20260531000013_product_reviews
-- Per-product reviews (Leafly/Weedmaps style) with denormalized rating_avg /
-- rating_count on products, kept in sync by a trigger (mirrors dispensaries).
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.products
  add column rating_avg numeric(2, 1) not null default 0,
  add column rating_count integer not null default 0;

create table public.product_reviews (
  id          uuid primary key default extensions.gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null,
  body        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint product_reviews_user_product_key unique (product_id, user_id),
  constraint product_reviews_rating_range check (rating between 1 and 5),
  constraint product_reviews_body_len check (body is null or char_length(body) <= 4000)
);

create index product_reviews_product_idx on public.product_reviews (product_id);
create index product_reviews_user_idx on public.product_reviews (user_id);

create trigger product_reviews_set_updated_at
  before update on public.product_reviews
  for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;

create policy product_reviews_select_public on public.product_reviews
  for select to anon, authenticated using (true);

-- A user may review (once) an in-stock-or-not product at an active dispensary.
create policy product_reviews_insert_self on public.product_reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.products p
      join public.dispensaries d on d.id = p.dispensary_id
      where p.id = product_reviews.product_id and d.status = 'active'
    )
  );

create policy product_reviews_update_author on public.product_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy product_reviews_delete_author_or_admin on public.product_reviews
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- ─── rating denormalization ──────────────────────────────────────────────────
create or replace function public.recalc_product_rating(target_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products p
  set rating_avg = coalesce(
        (select round(avg(rating)::numeric, 1) from public.product_reviews where product_id = target_id),
        0
      ),
      rating_count = (select count(*) from public.product_reviews where product_id = target_id)
  where p.id = target_id;
$$;

create or replace function public.product_reviews_rating_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalc_product_rating(coalesce(new.product_id, old.product_id));
  return null;
end;
$$;

create trigger product_reviews_sync_rating
  after insert or update or delete on public.product_reviews
  for each row execute function public.product_reviews_rating_sync();
