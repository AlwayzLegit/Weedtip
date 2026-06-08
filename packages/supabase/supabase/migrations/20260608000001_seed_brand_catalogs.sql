-- Seed each brand's canonical catalog (the "Official lineup" on brand pages).
-- Idempotent: only fills brands with no catalog yet. Per-item variety via hashtext.
with
cats as (select array_agg(id order by sort_order) ids, array_agg(slug order by sort_order) slugs
         from public.categories where slug <> 'accessories'),
sts as (select array_agg(name) names, array_agg(type::text) types from public.strains)
insert into public.brand_products
  (brand_id, category_id, name, description, image_url, thc_percentage, cbd_percentage, strain_type, sort_order)
select
  b.id,
  cats.ids[k.ci],
  nm.name,
  nm.descr,
  null,
  nm.thc, nm.cbd,
  case when c2.cslug in ('flower','pre-rolls','vapes','concentrates') then sts.types[k.si]::public.strain_type else null end,
  g.n
from public.brands b
cross join lateral generate_series(1, 5 + (abs(hashtext(b.id::text))%6)) g(n)
cross join cats cross join sts
cross join lateral (select
  1+(abs(hashtext(b.id::text||'/'||g.n||'/cat'))%array_length(cats.ids,1)) ci,
  1+(abs(hashtext(b.id::text||'/'||g.n||'/st'))%array_length(sts.names,1)) si,
  (abs(hashtext(b.id::text||'/'||g.n||'/sz'))%4) szi,
  (abs(hashtext(b.id::text||'/'||g.n||'/var'))%4) vari,
  (abs(hashtext(b.id::text||'/'||g.n||'/t'))%1000)/1000.0 rt
) k
cross join lateral (select cats.slugs[k.ci] cslug) c2
cross join lateral (select
  case c2.cslug
    when 'flower' then sts.names[k.si]||' '||(array['3.5g','7g','1g','14g'])[k.szi+1]
    when 'pre-rolls' then sts.names[k.si]||' '||(array['Pre-Roll','5-Pack Pre-Rolls','Infused Pre-Roll','Pre-Roll'])[k.vari+1]
    when 'vapes' then sts.names[k.si]||' '||(array['Cartridge 1g','Disposable 0.5g','Live Resin Cart 1g','Cartridge 0.5g'])[k.vari+1]
    when 'concentrates' then sts.names[k.si]||' '||(array['Live Resin 1g','Shatter 1g','Badder 1g','Rosin 1g'])[k.vari+1]
    when 'edibles' then (array['Watermelon Gummies 100mg','Sour Peach Gummies 100mg','Blueberry Chews 100mg','Dark Chocolate Bar 100mg'])[k.vari+1]
    when 'topicals' then (array['Relief Balm 500mg','Recovery Lotion 250mg','CBD Salve 1000mg','Muscle Rub 500mg'])[k.vari+1]
    else (array['1:1 Tincture 30ml','THC Drops 30ml','CBD Oil 30ml','Sleep Tincture 30ml'])[k.vari+1]
  end as name,
  case c2.cslug
    when 'flower' then sts.names[k.si]||' — '||sts.types[k.si]||' flower, small-batch and lab-tested.'
    when 'pre-rolls' then 'Hand-packed '||sts.names[k.si]||' pre-rolls, lab-tested.'
    when 'vapes' then sts.names[k.si]||' vape, potent and lab-tested.'
    when 'concentrates' then 'Solventless-style '||sts.names[k.si]||' concentrate, lab-tested.'
    when 'edibles' then 'Precisely-dosed edibles, made in California.'
    when 'topicals' then 'Fast-absorbing topical for targeted relief.'
    else 'Balanced tincture for precise, discreet dosing.'
  end as descr,
  case c2.cslug when 'flower' then round((18+k.rt*14)::numeric,1) when 'pre-rolls' then round((18+k.rt*12)::numeric,1)
    when 'vapes' then round((60+k.rt*32)::numeric,1) when 'concentrates' then round((65+k.rt*27)::numeric,1) else null end as thc,
  case c2.cslug when 'topicals' then round((2+k.rt*8)::numeric,1) when 'tinctures' then round((5+k.rt*15)::numeric,1) else null end as cbd
) nm
where not exists (select 1 from public.brand_products bp where bp.brand_id = b.id);
