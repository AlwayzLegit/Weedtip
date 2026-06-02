-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000019_review_owner_reply
-- Lets a dispensary owner publicly reply to a review of their shop (Weedmaps-style
-- review responses). Reply is written via a SECURITY DEFINER RPC that verifies the
-- caller owns the dispensary, so only reply columns can change (not rating/body).
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.reviews add column owner_reply text;
alter table public.reviews add column owner_reply_at timestamptz;

create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  clean text := nullif(btrim(p_reply), '');
begin
  select rv.id, rv.dispensary_id into r from public.reviews rv where rv.id = p_review_id;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if not public.owns_dispensary(r.dispensary_id) and not public.is_admin() then
    raise exception 'Only the dispensary owner can reply to this review' using errcode = '42501';
  end if;
  update public.reviews
    set owner_reply = clean,
        owner_reply_at = case when clean is null then null else now() end
  where id = p_review_id;
end;
$$;

revoke all on function public.reply_to_review(uuid, text) from public, anon;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
