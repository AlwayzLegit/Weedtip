-- Winning bidders for a location → featured on the public finder. Returns only
-- the dispensary ids of bids holding a slot (top `slots` per region); no amounts
-- exposed. SECURITY DEFINER so anon can read winners without seeing the bids.
set search_path = public;

create or replace function public.region_featured_dispensaries(p_state char(2), p_city text default null)
returns table (dispensary_id uuid)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select b.dispensary_id, b.region_id,
      rank() over (partition by b.region_id order by b.bid_cents desc, b.created_at) as rnk,
      r.slots
    from public.ad_bids b
    join public.ad_regions r on r.id = b.region_id
    where b.status = 'active' and r.is_active and r.state = p_state
      and (r.city is null or (p_city is not null and lower(r.city) = lower(p_city)))
  )
  select distinct dispensary_id from ranked where rnk <= slots;
$$;
grant execute on function public.region_featured_dispensaries(char, text) to anon, authenticated;
