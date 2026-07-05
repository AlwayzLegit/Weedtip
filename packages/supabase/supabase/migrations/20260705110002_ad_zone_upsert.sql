-- 20260705110002_ad_zone_upsert
-- Admin zone create/edit. A dedicated RPC because the centroid is PostGIS
-- geometry (built from lng/lat here) and new zones should immediately get the
-- same starter disc boundary the seed used, so resolve_geo covers them.

create or replace function public.admin_upsert_ad_zone(
  p_region_id uuid,
  p_slug text,
  p_name text,
  p_lng float8,
  p_lat float8,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_centroid geometry := st_setsrid(st_makepoint(p_lng, p_lat), 4326);
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_lng not between -180 and 180 or p_lat not between -90 and 90 then
    raise exception 'Centroid out of range';
  end if;

  if p_id is null then
    insert into public.ad_zones (region_id, slug, name, centroid, boundary)
    values (
      p_region_id, p_slug, p_name, v_centroid,
      st_multi(st_buffer(v_centroid::geography, 2500)::geometry)
    )
    returning id into v_id;
  else
    update public.ad_zones
    set region_id = p_region_id, slug = p_slug, name = p_name, centroid = v_centroid
    where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.admin_upsert_ad_zone(uuid, text, text, float8, float8, uuid) from public, anon;
grant execute on function public.admin_upsert_ad_zone(uuid, text, text, float8, float8, uuid) to authenticated;
