-- ════════════════════════════════════════════════════════════════════════════
-- 20260722230000_canonical_dispensary_dupes
--
-- Semrush flagged duplicate titles/descriptions/content. Root cause: the same
-- physical business was imported more than once, so several active listings
-- share a google_place_id (the strongest "same shop" signal — license_number is
-- already unique, and same name+city can be legitimately different branches).
--
-- Fix: point every redundant duplicate's canonical URL at ONE primary listing so
-- Google consolidates the ranking signals instead of splitting them across
-- near-identical pages. No rows are deleted — the pages still resolve, they just
-- declare a canonical. `canonical_slug` is null for the primary (self-canonical)
-- and for every non-duplicate listing.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.dispensaries
  add column if not exists canonical_slug text;

comment on column public.dispensaries.canonical_slug is
  'When set, this listing is a duplicate of another (shared google_place_id); its canonical URL points at that primary slug. Null = self-canonical.';

-- Rank rows within each duplicated google_place_id group and mark the primary as
-- the most complete listing (has a cover photo, then most reviews, then the
-- shortest/base slug). Non-primary rows get canonical_slug = the primary's slug.
with ranked as (
  select
    id,
    slug,
    google_place_id,
    row_number() over (
      partition by google_place_id
      order by
        (cover_image_url is not null) desc,
        rating_count desc nulls last,
        length(slug) asc,
        slug asc
    ) as rn,
    first_value(slug) over (
      partition by google_place_id
      order by
        (cover_image_url is not null) desc,
        rating_count desc nulls last,
        length(slug) asc,
        slug asc
    ) as primary_slug
  from public.dispensaries
  where status = 'active'
    and google_place_id is not null
    and google_place_id in (
      select google_place_id
      from public.dispensaries
      where status = 'active' and google_place_id is not null
      group by google_place_id
      having count(*) > 1
    )
)
update public.dispensaries d
set canonical_slug = ranked.primary_slug
from ranked
where d.id = ranked.id
  and ranked.rn > 1;
