-- Perf: wrap row-independent auth calls in RLS policies as scalar subqueries so
-- Postgres evaluates them once per query (init-plan) instead of once per row
-- (Supabase advisor: auth_rls_initplan). Targets only policies that reference
-- auth.uid()/auth_role(); also wraps is_admin() (which runs a profiles lookup).
-- Row-dependent calls (owns_dispensary(col), EXISTS(...)) are left as-is.
-- Idempotent: unwrap then re-wrap, so re-running never double-wraps.
do $$
declare r record; newq text; newc text; stmt text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('brand_claims','brand_followers','brand_products','brand_updates',
        'deal_redemptions','device_tokens','dispensaries','favorites','notifications','orders',
        'ownership_requests','placement_events','product_reviews','profiles','reviews','strain_favorites')
      and (
        (coalesce(qual,'') || coalesce(with_check,'')) like '%auth.uid()%'
        or (coalesce(qual,'') || coalesce(with_check,'')) like '%auth_role()%'
      )
  loop
    newq := r.qual; newc := r.with_check;
    if newq is not null then
      newq := replace(newq, '(select auth.uid())', 'auth.uid()');
      newq := replace(newq, 'auth.uid()', '(select auth.uid())');
      newq := replace(newq, '(select auth_role())', 'auth_role()');
      newq := replace(newq, 'auth_role()', '(select auth_role())');
      newq := replace(newq, '(select is_admin())', 'is_admin()');
      newq := replace(newq, 'is_admin()', '(select is_admin())');
    end if;
    if newc is not null then
      newc := replace(newc, '(select auth.uid())', 'auth.uid()');
      newc := replace(newc, 'auth.uid()', '(select auth.uid())');
      newc := replace(newc, '(select auth_role())', 'auth_role()');
      newc := replace(newc, 'auth_role()', '(select auth_role())');
      newc := replace(newc, '(select is_admin())', 'is_admin()');
      newc := replace(newc, 'is_admin()', '(select is_admin())');
    end if;
    stmt := 'alter policy ' || quote_ident(r.policyname) || ' on public.' || quote_ident(r.tablename);
    if newq is not null then stmt := stmt || ' using (' || newq || ')'; end if;
    if newc is not null then stmt := stmt || ' with check (' || newc || ')'; end if;
    execute stmt;
  end loop;
end $$;
