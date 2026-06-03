-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000029_sale_prices_batch
-- Cross-dispensary batch resolver for effective sale prices, so the product
-- grid (/products, category pages) and product detail can show the same sale
-- price the dispensary menu and checkout already use. Returns only products
-- that currently have a real discount.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.sale_prices_for(p_product_ids uuid[])
returns table (product_id uuid, sale_cents integer, deal_id uuid, deal_title text)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, e.unit_cents, e.deal_id, e.deal_title
  from public.products p
  cross join lateral public.effective_unit_price(p.id) e
  where p.id = any(p_product_ids)
    and e.deal_id is not null
    and e.unit_cents < p.price_cents;
$$;
grant execute on function public.sale_prices_for(uuid[]) to anon, authenticated;
