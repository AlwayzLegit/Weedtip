-- ════════════════════════════════════════════════════════════════════════════
-- 20260719210000_brand_cover
-- Weedmaps-grade brand pages: a cover banner. Free-tier identity basic, same
-- as the dispensary cover.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.brands add column if not exists cover_image_url text;

-- update_owned_brand learns the cover banner (added as a defaulted param so
-- existing 4-arg callers keep working during deploy overlap).
create or replace function public.update_owned_brand(
  p_brand_id uuid,
  p_description text,
  p_logo_url text,
  p_website text,
  p_cover_image_url text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.brands where id = p_brand_id and owner_id = auth.uid()) then
    raise exception 'Not authorized for this brand' using errcode = '42501';
  end if;
  update public.brands
    set description = p_description,
        logo_url = p_logo_url,
        website = p_website,
        cover_image_url = coalesce(p_cover_image_url, cover_image_url),
        updated_at = now()
    where id = p_brand_id;
end; $function$;
