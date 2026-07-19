-- ════════════════════════════════════════════════════════════════════════════
-- 20260719260000_brand_cover_clear
-- QA fix: the cover banner could never be REMOVED. The action omits the param
-- when the field is absent (preserve) but the ImagePicker's "Remove image"
-- submits '' — which the old coalesce(null → keep) collapsed into "preserve",
-- so the banner silently reappeared after "Saved." Now: null = keep,
-- '' = clear, value = set.
-- ════════════════════════════════════════════════════════════════════════════
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
        cover_image_url = case
          when p_cover_image_url is null then cover_image_url
          else nullif(p_cover_image_url, '')
        end,
        updated_at = now()
    where id = p_brand_id;
end; $function$;
