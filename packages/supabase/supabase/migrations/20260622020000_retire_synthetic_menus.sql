-- Retire the synthetic demo menus.
--
-- Early seeds populated every imported dispensary with ~13 placeholder products
-- so the catalog wasn't empty during build-out. Now that dispensary detail pages
-- render a proper "Menu coming soon — claim to add" empty state, those fake
-- menus should go: an unclaimed listing showing invented products is misleading.
--
-- Conservative scope: only delete products belonging to UNCLAIMED dispensaries
-- (owner_id is null). Products on a claimed dispensary are left for its owner to
-- manage. Idempotent.

delete from public.products p
using public.dispensaries d
where d.id = p.dispensary_id
  and d.owner_id is null;
