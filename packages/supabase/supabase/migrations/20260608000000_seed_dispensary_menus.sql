-- Seed realistic dispensary menus from the real brands/strains/categories.
-- Set-based generation; idempotent (only fills dispensaries that have no products).
-- Per-row variety via hashtext(dispensary || index || salt) so picks differ per item.
with
cats as (select array_agg(id order by sort_order) ids, array_agg(slug order by sort_order) slugs from public.categories),
brs as (select array_agg(id) ids, array_agg(name) names from public.brands),
sts as (select array_agg(id) ids, array_agg(name) names, array_agg(type::text) types from public.strains)
insert into public.products
  (dispensary_id, category_id, brand_id, strain_id, name, slug, strain_type,
   thc_percentage, cbd_percentage, price_cents, in_stock, is_featured, image_urls)
select
  d.id,
  cats.ids[k.ci],
  brs.ids[k.bi],
  case when c2.cslug in ('flower','pre-rolls','vapes','concentrates') then sts.ids[k.si] else null end,
  nm.name,
  trim(both '-' from regexp_replace(lower(nm.name),'[^a-z0-9]+','-','g'))||'-'||g.n,
  case when c2.cslug in ('flower','pre-rolls','vapes','concentrates') then sts.types[k.si]::public.strain_type else null end,
  nm.thc, nm.cbd, nm.price,
  (abs(hashtext(d.id::text||'/'||g.n||'/is'))%10) < 9,
  (abs(hashtext(d.id::text||'/'||g.n||'/ft'))%100) < 6,
  '{}'::text[]
from public.dispensaries d
cross join lateral generate_series(1, 8 + (abs(hashtext(d.id::text))%11)) g(n)
cross join cats cross join brs cross join sts
cross join lateral (select
  1+(abs(hashtext(d.id::text||'/'||g.n||'/cat'))%array_length(cats.ids,1)) ci,
  1+(abs(hashtext(d.id::text||'/'||g.n||'/br'))%array_length(brs.ids,1)) bi,
  1+(abs(hashtext(d.id::text||'/'||g.n||'/st'))%array_length(sts.ids,1)) si,
  (abs(hashtext(d.id::text||'/'||g.n||'/sz'))%4) szi,
  (abs(hashtext(d.id::text||'/'||g.n||'/var'))%4) vari,
  (abs(hashtext(d.id::text||'/'||g.n||'/p'))%1000)/1000.0 rp,
  (abs(hashtext(d.id::text||'/'||g.n||'/t'))%1000)/1000.0 rt
) k
cross join lateral (select cats.slugs[k.ci] cslug) c2
cross join lateral (select
  case c2.cslug
    when 'flower' then brs.names[k.bi]||' '||sts.names[k.si]||' '||(array['3.5g','7g','1g','14g'])[k.szi+1]
    when 'pre-rolls' then brs.names[k.bi]||' '||sts.names[k.si]||' '||(array['Pre-Roll','5-Pack Pre-Rolls','Infused Pre-Roll','Pre-Roll'])[k.vari+1]
    when 'vapes' then brs.names[k.bi]||' '||sts.names[k.si]||' '||(array['Cartridge 1g','Disposable 0.5g','Live Resin Cart 1g','Cartridge 0.5g'])[k.vari+1]
    when 'concentrates' then brs.names[k.bi]||' '||sts.names[k.si]||' '||(array['Live Resin 1g','Shatter 1g','Badder 1g','Rosin 1g'])[k.vari+1]
    when 'edibles' then brs.names[k.bi]||' '||(array['Watermelon Gummies 100mg','Sour Peach Gummies 100mg','Blueberry Chews 100mg','Dark Chocolate Bar 100mg'])[k.vari+1]
    when 'topicals' then brs.names[k.bi]||' '||(array['Relief Balm 500mg','Recovery Lotion 250mg','CBD Salve 1000mg','Relief Balm 500mg'])[k.vari+1]
    when 'tinctures' then brs.names[k.bi]||' '||(array['1:1 Tincture 30ml','THC Drops 30ml','CBD Oil 30ml','1:1 Tincture 30ml'])[k.vari+1]
    else brs.names[k.bi]||' '||(array['Grinder','Rolling Tray','Glass Pipe','510 Battery'])[k.vari+1]
  end as name,
  case c2.cslug when 'flower' then round((18+k.rt*14)::numeric,1) when 'pre-rolls' then round((18+k.rt*12)::numeric,1)
    when 'vapes' then round((60+k.rt*32)::numeric,1) when 'concentrates' then round((65+k.rt*27)::numeric,1) else null end as thc,
  case c2.cslug when 'topicals' then round((2+k.rt*8)::numeric,1) when 'tinctures' then round((5+k.rt*15)::numeric,1) else null end as cbd,
  case c2.cslug when 'flower' then (array[3500,6000,1500,9000])[k.szi+1]
    when 'pre-rolls' then 800+(k.rp*1700)::int when 'vapes' then 2500+(k.rp*4000)::int
    when 'concentrates' then 3000+(k.rp*4000)::int when 'edibles' then 1200+(k.rp*2300)::int
    when 'topicals' then 2000+(k.rp*4000)::int when 'tinctures' then 2500+(k.rp*4500)::int
    else 800+(k.rp*4200)::int end as price
) nm
where d.status='active'
  and not exists (select 1 from public.products p where p.dispensary_id = d.id);
