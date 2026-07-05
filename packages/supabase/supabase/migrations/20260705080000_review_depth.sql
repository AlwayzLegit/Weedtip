-- ════════════════════════════════════════════════════════════════════════════
-- 20260705080000_review_depth
-- Workstream 2: reviews grow up — photos and "helpful" votes.
-- - reviews.photo_urls: up to 4 storage URLs uploaded by the author.
-- - review_votes: one helpful-vote per user per review (not on your own),
--   denormalized into reviews.helpful_count by trigger for cheap sorting.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

alter table public.reviews
  add column if not exists photo_urls text[] not null default '{}',
  add column if not exists helpful_count integer not null default 0;

do $$ begin
  alter table public.reviews
    add constraint reviews_photos_max check (coalesce(array_length(photo_urls, 1), 0) <= 4);
exception when duplicate_object then null; end $$;

create table if not exists public.review_votes (
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.review_votes enable row level security;

-- Readers only need their own votes (counts come from helpful_count).
create policy review_votes_select_self on public.review_votes
  for select to authenticated using (user_id = (select auth.uid()));

-- Vote once, not on your own review.
create policy review_votes_insert_self on public.review_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id <> (select auth.uid())
    )
  );

create policy review_votes_delete_self on public.review_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Keep the denormalized count in step. SECURITY DEFINER: the voter isn't
-- allowed to UPDATE someone else's review row directly.
create or replace function public.bump_review_helpful()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
    return new;
  end if;
  update public.reviews
    set helpful_count = greatest(helpful_count - 1, 0)
    where id = old.review_id;
  return old;
end;
$$;

drop trigger if exists review_votes_bump on public.review_votes;
create trigger review_votes_bump
  after insert or delete on public.review_votes
  for each row execute function public.bump_review_helpful();
