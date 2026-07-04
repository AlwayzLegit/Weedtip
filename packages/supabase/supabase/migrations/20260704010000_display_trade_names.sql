-- ════════════════════════════════════════════════════════════════════════════
-- 20260704010000_display_trade_names
-- Display names = trade names (directory practice: Yelp/Google/Weedmaps show the
-- shopper-facing name; the legal entity lives in fine print). The nationwide
-- import surfaced two patterns on unclaimed rows:
--   1. "Legal Entity, LLC DBA Trade Name" packed into one field (VT et al.)
--   2. bare legal names as the display name ("April Flowers LLC")
-- Extract the trade side, strip legal-entity designators, and preserve the
-- original legal string into legal_name (surfaced as "Licensed as …").
-- "Co"/"Company" are deliberately NOT stripped — they're brand vocabulary here
-- ("Boston Bud Co", "10th Street Cannabis CO."). Claimed rows (owner_id set)
-- are owner-curated and untouched. Slugs are never changed (stable URLs).
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- 1) Split "Legal, LLC DBA Trade" combos: display the trade side, keep the
--    legal side in legal_name (only where legal_name is empty). Multi-DBA
--    tails ("…/ DBA Other Name)") are dropped from the display.
with src as (
  select id, name,
    (regexp_match(name, '\mdba\M[[:space:].:)]*(.+)$', 'i'))[1] as after_dba,
    (regexp_match(name, '^(.*?)[[:space:],:;(]*\mdba\M', 'i'))[1] as before_dba
  from public.dispensaries
  where owner_id is null and name ~* '\mdba\M'
), calc as (
  select id,
    nullif(trim(both ' )/,.' from regexp_replace(
      after_dba, '[[:space:]]*[/;,]?[[:space:]]*\(?[[:space:]]*\mdba\M.*$', '', 'i')), '') as trade,
    nullif(trim(both ' ,:;(' from before_dba), '') as legal_part
  from src
)
update public.dispensaries d
set name = c.trade,
    legal_name = coalesce(d.legal_name, c.legal_part)
from calc c
where d.id = c.id
  and c.trade is not null and char_length(c.trade) >= 2
  and lower(c.trade) <> lower(d.name);

-- 2) Strip trailing legal-entity designators from remaining display names,
--    preserving the original into legal_name where it was empty.
with calc as (
  select id, name as old_name,
    nullif(trim(both ' ,' from regexp_replace(
      name,
      '([[:space:],]+(llc|l\.l\.c\.?|inc\.?|incorporated|corp\.?|corporation|ltd\.?|limited|llp|pllc))+[[:space:].,]*$',
      '', 'i')), '') as trade
  from public.dispensaries
  where owner_id is null
    and name ~* '[[:space:],](llc|l\.l\.c\.?|inc\.?|incorporated|corp\.?|corporation|ltd\.?|limited|llp|pllc)[[:space:].,]*$'
)
update public.dispensaries d
set legal_name = coalesce(d.legal_name, c.old_name),
    name = c.trade
from calc c
where d.id = c.id
  and c.trade is not null and char_length(c.trade) >= 2
  and lower(c.trade) <> lower(d.name);

-- 3) Tidy residue: empty parens, doubled spaces, stray edge punctuation.
update public.dispensaries
set name = trim(both ' ,' from regexp_replace(
      regexp_replace(name, '\([[:space:]]*\)', '', 'g'), '[[:space:]]{2,}', ' ', 'g'))
where owner_id is null
  and (name ~ '\([[:space:]]*\)' or name ~ '[[:space:]]{2,}'
       or name ~ '^[[:space:],]' or name ~ '[[:space:],]$')
  and char_length(trim(both ' ,' from regexp_replace(
        regexp_replace(name, '\([[:space:]]*\)', '', 'g'), '[[:space:]]{2,}', ' ', 'g'))) >= 2;
