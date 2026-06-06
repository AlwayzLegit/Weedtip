-- Brand updates & followers (mirrors the dispensary follow + updates system).
set search_path = public;

-- Follow a brand.
create table if not exists public.brand_followers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, brand_id)
);
create index if not exists brand_followers_brand_idx on public.brand_followers (brand_id);
alter table public.brand_followers enable row level security;
create policy brand_followers_select on public.brand_followers
  for select using (user_id = auth.uid());
create policy brand_followers_insert on public.brand_followers
  for insert with check (user_id = auth.uid());
create policy brand_followers_delete on public.brand_followers
  for delete using (user_id = auth.uid());

-- Brand updates; live for 6 weeks.
create table if not exists public.brand_updates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 weeks')
);
create index if not exists brand_updates_brand_idx on public.brand_updates (brand_id, created_at desc);
alter table public.brand_updates enable row level security;
create policy brand_updates_select on public.brand_updates for select using (true);
create policy brand_updates_write on public.brand_updates
  for all using (
    public.is_admin()
    or exists (select 1 from public.brands b where b.id = brand_updates.brand_id and b.owner_id = auth.uid())
  ) with check (
    public.is_admin()
    or exists (select 1 from public.brands b where b.id = brand_updates.brand_id and b.owner_id = auth.uid())
  );

-- Follower count, owner/admin only.
create or replace function public.brand_follower_count(p_brand_id uuid)
returns integer language sql security definer set search_path = public as $$
  select case
    when public.is_admin() or exists (select 1 from public.brands b where b.id = p_brand_id and b.owner_id = auth.uid())
    then (select count(*)::int from public.brand_followers where brand_id = p_brand_id)
    else 0
  end;
$$;
revoke all on function public.brand_follower_count(uuid) from public, anon;
grant execute on function public.brand_follower_count(uuid) to authenticated;

-- Owner posts an update; fans it out to followers as notifications.
create or replace function public.post_brand_update(p_brand_id uuid, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  b record;
  clean_title text := btrim(p_title);
  clean_body text := nullif(btrim(p_body), '');
begin
  if not public.is_admin()
     and not exists (select 1 from public.brands x where x.id = p_brand_id and x.owner_id = auth.uid()) then
    raise exception 'Only the brand owner can post updates' using errcode = '42501';
  end if;
  if clean_title is null or clean_title = '' then
    raise exception 'An update needs a title' using errcode = '22000';
  end if;
  select name, slug into b from public.brands where id = p_brand_id;

  insert into public.brand_updates (brand_id, title, body)
    values (p_brand_id, left(clean_title, 140), clean_body)
    returning id into new_id;

  insert into public.notifications (user_id, type, title, body, data)
    select f.user_id, 'brand_update', b.name || ': ' || left(clean_title, 140), clean_body,
           jsonb_build_object('brand_slug', b.slug, 'brand_id', p_brand_id, 'update_id', new_id)
    from public.brand_followers f
    where f.brand_id = p_brand_id;

  return new_id;
end; $$;
revoke all on function public.post_brand_update(uuid, text, text) from public, anon;
grant execute on function public.post_brand_update(uuid, text, text) to authenticated;
