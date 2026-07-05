-- ════════════════════════════════════════════════════════════════════════════
-- 20260705000000_admin_dispensary_tooling
-- Audit finding #21: no admin edit/delete/merge tooling — 241+ duplicate
-- groups, 508 null licenses, and 680 null addresses were fixable only via raw
-- SQL. This adds the two data-destructive primitives as guarded RPCs; field
-- edits go through the normal admin RLS update path.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- Delete a listing outright. Blocked when order history exists (orders FK is
-- ON DELETE RESTRICT — that history is financial record); everything else
-- cascades. Admin only.
create or replace function public.admin_delete_dispensary(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  n_orders integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select count(*) into n_orders from public.orders where dispensary_id = p_id;
  if n_orders > 0 then
    raise exception 'This listing has % orders and cannot be deleted. Merge it into another listing instead.', n_orders
      using errcode = '22023';
  end if;
  delete from public.dispensaries where id = p_id;
end; $$;
revoke all on function public.admin_delete_dispensary(uuid) from public, anon;
grant execute on function public.admin_delete_dispensary(uuid) to authenticated;

-- Merge duplicate listings: repoint every child row from the duplicate onto
-- the keeper, backfill data the keeper is missing, then delete the duplicate.
-- Child tables are discovered from the FK catalog so new tables are covered
-- automatically. Where moving a row would violate a uniqueness constraint
-- (e.g. the same user favorited or reviewed both listings), the duplicate's
-- conflicting row is dropped and the keeper's copy wins.
create or replace function public.admin_merge_dispensaries(p_keep uuid, p_dup uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  fk record;
  row_ctid tid;
  ctids tid[];
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_keep = p_dup then
    raise exception 'Pick two different listings.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.dispensaries where id = p_keep)
     or not exists (select 1 from public.dispensaries where id = p_dup) then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;

  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.confrelid = 'public.dispensaries'::regclass and c.contype = 'f'
  loop
    begin
      execute format('update %s set %I = $1 where %I = $2', fk.tbl, fk.col, fk.col)
        using p_keep, p_dup;
    exception when unique_violation then
      -- Move row-by-row; drop the duplicate's row where the keeper already
      -- has the equivalent (favorites, reviews, subscriptions, ...).
      execute format('select array_agg(ctid) from %s where %I = $1', fk.tbl, fk.col)
        into ctids using p_dup;
      foreach row_ctid in array coalesce(ctids, '{}') loop
        begin
          execute format('update %s set %I = $1 where ctid = $2', fk.tbl, fk.col)
            using p_keep, row_ctid;
        exception when unique_violation then
          execute format('delete from %s where ctid = $1', fk.tbl) using row_ctid;
        end;
      end loop;
    end;
  end loop;

  -- Backfill anything the keeper is missing from the duplicate, and union the
  -- service/legality flags.
  update public.dispensaries k
  set legal_name       = coalesce(k.legal_name, d.legal_name),
      license_number   = coalesce(k.license_number, d.license_number),
      description      = coalesce(k.description, d.description),
      address          = coalesce(k.address, d.address),
      city             = coalesce(k.city, d.city),
      county           = coalesce(k.county, d.county),
      zip              = coalesce(k.zip, d.zip),
      phone            = coalesce(k.phone, d.phone),
      email            = coalesce(k.email, d.email),
      website          = coalesce(k.website, d.website),
      logo_url         = coalesce(k.logo_url, d.logo_url),
      cover_image_url  = coalesce(k.cover_image_url, d.cover_image_url),
      hours            = coalesce(k.hours, d.hours),
      location         = coalesce(k.location, d.location),
      timezone         = coalesce(k.timezone, d.timezone),
      google_place_id  = coalesce(k.google_place_id, d.google_place_id),
      google_photo_name = coalesce(k.google_photo_name, d.google_photo_name),
      dcc_phone        = coalesce(k.dcc_phone, d.dcc_phone),
      dcc_email        = coalesce(k.dcc_email, d.dcc_email),
      owner_id         = coalesce(k.owner_id, d.owner_id),
      is_delivery      = k.is_delivery or d.is_delivery,
      is_pickup        = k.is_pickup or d.is_pickup,
      is_medical       = k.is_medical or d.is_medical,
      is_recreational  = k.is_recreational or d.is_recreational
  from public.dispensaries d
  where k.id = p_keep and d.id = p_dup;

  delete from public.dispensaries where id = p_dup;
end; $$;
revoke all on function public.admin_merge_dispensaries(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_dispensaries(uuid, uuid) to authenticated;
