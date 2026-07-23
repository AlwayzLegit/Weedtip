-- Google Search Console coverage monitor.
--
-- Stores the URL Inspection API result per page: how Google actually sees each
-- URL (indexed vs not — and *why*: "Crawled - currently not indexed" is a
-- thin-content judgment, "Discovered - currently not indexed" is crawl budget,
-- etc.). Written by apps/web/scripts/gsc-inspect.mjs via the service role;
-- read by admins on the Integrations/SEO console.
create table if not exists public.page_index_status (
  url               text primary key,
  verdict           text,        -- PASS / PARTIAL / FAIL / NEUTRAL
  coverage_state    text,        -- e.g. "Submitted and indexed", "Crawled - currently not indexed"
  robots_txt_state  text,
  indexing_state    text,        -- INDEXING_ALLOWED / BLOCKED_BY_META_TAG / ...
  page_fetch_state  text,        -- SUCCESSFUL / SOFT_404 / NOT_FOUND / ...
  last_crawl_time   timestamptz,
  google_canonical  text,
  user_canonical    text,
  referring_urls    integer,     -- how many referring URLs GSC reports (internal-link signal)
  in_sitemap        boolean,
  checked_at        timestamptz not null default now()
);

create index if not exists page_index_status_coverage_idx on public.page_index_status (coverage_state);
create index if not exists page_index_status_checked_idx on public.page_index_status (checked_at);

alter table public.page_index_status enable row level security;

-- Admin-only read; the inspection script writes with the service role, which
-- bypasses RLS. No public/insert policy — nobody but admins should see this.
drop policy if exists "page_index_status admin read" on public.page_index_status;
create policy "page_index_status admin read"
  on public.page_index_status
  for select
  to authenticated
  using ((select public.is_admin()));

comment on table public.page_index_status is
  'GSC URL Inspection results per URL. Written by scripts/gsc-inspect.mjs (service role); read by admins.';
