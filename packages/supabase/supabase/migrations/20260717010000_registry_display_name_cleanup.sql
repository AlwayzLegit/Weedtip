-- ════════════════════════════════════════════════════════════════════════════
-- 20260717010000_registry_display_name_cleanup
--
-- Registry-sourced listings carried legal-filing strings as display names:
-- quoted alternatives ("'X' Or 'Y' Or 'Z'"), D/B/A constructions where the
-- real brand sits after the marker, semicolon-separated alternatives,
-- "(FKA ...)" parentheticals, and trailing legal suffixes (", LLC", "INC.").
-- Clean the DISPLAY name (slugs/URLs untouched) and preserve the original
-- into legal_name when it was empty. 153 rows changed when applied.
-- ════════════════════════════════════════════════════════════════════════════

with cleaned as (
  select id, name as orig,
    btrim(
      regexp_replace(regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              case
                when name ~ $$^'([^']+)' [Oo]r $$ then (regexp_match(name, $$^'([^']+)'$$))[1]
                else name
              end,
              '(?i)^.*D\s*[./]\s*B\s*[./]\s*A[./]*\s+', ''),
            ';.*$', ''),
          '(?i)\s*\((fka|formerly)[^)]*\)', '', 'g'),
        '(?i),?\s+(L\.?L\.?C\.?|INC\.?|CORP\.?|Corporation|Incorporated|Ltd\.?)\s*$', ''),
      '(?i),?\s+(L\.?L\.?C\.?|INC\.?|CORP\.?|Corporation|Incorporated|Ltd\.?)\s*$', ''),
    ' ,') as new_name
  from public.dispensaries where status = 'active'
)
update public.dispensaries d
set legal_name = coalesce(d.legal_name, d.name),
    name = c.new_name
from cleaned c
where d.id = c.id
  and c.new_name <> c.orig
  and length(c.new_name) >= 2;

-- Stragglers with mid-name legalese the generic pass can't safely handle.
with fixes(orig, new_name) as (
  values
    ('Dames INC, Dames', 'Dames'),
    ('High Valley Cannabis CO - Open 24 Hours INC Holidays!', 'High Valley Cannabis CO'),
    ('Herbmont INC., Herbmont', 'Herbmont'),
    ('Tomcat LLC _ Polson Cannabis', 'Polson Cannabis'),
    ('The Higher Standard Corp Helena', 'The Higher Standard Helena'),
    ('The Higher Standard Corp Missoula', 'The Higher Standard Missoula'),
    ('Columbia Care Pa LLC - Wilkes- Barre', 'Columbia Care Wilkes-Barre'),
    ('Knox Medical (Cansortium Pennsylvania. LLC)', 'Knox Medical'),
    ('Nxnw Retail LLC / Cannabis And Glass', 'Cannabis And Glass'),
    ('Nxnw Retail LLC/Cannabis & Glass', 'Cannabis & Glass'),
    ('Happy Time LLC 3', 'Happy Time 3'),
    ('Happy Time LLC 2', 'Happy Time 2'),
    ('Kush Alley, INC., A California', 'Kush Alley')
)
update public.dispensaries d
set legal_name = coalesce(d.legal_name, d.name),
    name = f.new_name
from fixes f
where d.status = 'active' and d.name = f.orig;
