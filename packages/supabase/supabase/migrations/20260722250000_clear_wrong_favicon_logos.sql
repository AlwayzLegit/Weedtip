-- ════════════════════════════════════════════════════════════════════════════
-- 20260722250000_clear_wrong_favicon_logos
--
-- Auto-derived logos came from the *website* domain's Google S2 favicon. When a
-- listing's website points at a third-party platform (Weedmaps, Dutchie, Leafly)
-- or a social/link-in-bio page (Facebook, Instagram, Linktree), the "logo" is
-- that PLATFORM's favicon — e.g. the-fireweed-factory-llc showed the Weedmaps
-- logo. Those are wrong, not the shop's mark.
--
-- Null them so the UI falls back to our own placeholder instead of a competitor
-- or social icon. Favicons from a shop's OWN domain (chains like trulieve.com,
-- curaleaf.com, stiiizy.com) are genuine logomarks and are kept.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  bad text[] := array[
    -- Menu / aggregator platforms (their favicon, not the shop's)
    'weedmaps.com','dutchie.com','leafly.com','iheartjane.com','jane.com',
    'allbud.com','potguide.com','wheresweed.com','leaflink.com','getmeadow.com',
    'meadow.com','tymber.io','sweed.io','blaze.me','greenrush.com','dispenseapp.com',
    'webjoint.com',
    -- Social / link-in-bio
    'facebook.com','instagram.com','twitter.com','x.com','tiktok.com','linktr.ee',
    'linktree.com','beacons.ai','snapchat.com','youtube.com',
    -- Generic / non-brand
    'google.com','sites.google.com','business.site','bit.ly','yelp.com'
  ];
begin
  update public.dispensaries
  set logo_url = null
  where logo_url like '%s2/favicons%'
    and lower(substring(logo_url from 'domain=([^&]+)')) = any(bad);

  update public.brands
  set logo_url = null
  where logo_url like '%s2/favicons%'
    and lower(substring(logo_url from 'domain=([^&]+)')) = any(bad);
end $$;
