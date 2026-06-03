-- Brand enrichment: an optional website link, surfaced on the public brand page
-- and editable by admins. Part of brand product linking (brands enriching the
-- menus that carry them).
alter table public.brands add column if not exists website text;
