# Search indexing: IndexNow + Google Search Console

Two independent pipelines that help pages get crawled and let us see how Google
treats them. **Neither can "force" Google to index a page** — no such API exists
for general/directory pages (Google's Indexing API is restricted to job-posting
and livestream pages, and using it for anything else is against its terms). What
these do:

| Pipeline | Engines | What it does |
|---|---|---|
| **IndexNow** | Bing, Yandex, Naver, Seznam (**not Google**) | Pushes "this URL changed, re-crawl it" |
| **GSC coverage** | Google | *Reads* how Google sees each page (indexed vs not, and why) |

For Google, the levers that actually move indexation are the sitemap (already
shipped), internal linking, and content depth — the GSC monitor tells us where
those are failing, page by page.

---

## 1. IndexNow (already wired — no console setup)

- Key: `7c2f4e28ef2ccf7b90c82e2b5954ee45`, served at
  `https://www.weedtip.com/7c2f4e28ef2ccf7b90c82e2b5954ee45.txt`
  (`apps/web/public/…​.txt`) and referenced from `apps/web/lib/indexnow.ts`.
- Submitter: `scripts/indexnow-submit.mjs` (nightly `.github/workflows/indexnow.yml`).
- Runtime: import `submitUrl`/`submitUrls` from `lib/indexnow.ts` to ping when a
  listing is created or materially changes.

Only repo secret needed: `SUPABASE_SERVICE_ROLE_KEY` (already set). Manual run:
Actions → **IndexNow submit** → check **all** for a full pass.

---

## 2. Google Search Console coverage monitor (needs one-time GCP setup)

The nightly job (`.github/workflows/gsc-inspect.yml` →
`scripts/gsc-inspect.mjs`) calls the URL Inspection API and records each page's
status in `public.page_index_status`. It uses a **service account** (no
interactive login, no token refresh).

### One-time setup (only you can do these — GCP + Search Console access)

1. **Google Cloud Console** → create/pick a project.
2. **APIs & Services → Enable APIs** → enable **Google Search Console API**
   (a.k.a. "Search Console API").
3. **IAM & Admin → Service Accounts → Create service account**
   (e.g. `gsc-inspector`). No project roles needed.
4. On that service account → **Keys → Add key → JSON** → download the key file.
5. **Search Console** (search.google.com/search-console) → your property →
   **Settings → Users and permissions → Add user** → paste the service
   account's email (the `client_email` in the JSON, looks like
   `gsc-inspector@<project>.iam.gserviceaccount.com`) → permission **Restricted**
   (Full also works). This is what authorizes it to read your data.

### Add the secret/vars in GitHub (repo Settings)

- **Secret** `GSC_SERVICE_ACCOUNT_JSON` = the entire contents of the JSON key file.
- (optional) **Variable** `GSC_SITE_URL` — defaults to `sc-domain:weedtip.com`.
  Use a **Domain property** in Search Console so it covers both apex and `www`.
  If you only have a URL-prefix property, set this to `https://www.weedtip.com/`.

### Run it

Actions → **GSC coverage inspect** → Run workflow. First runs fill
`page_index_status`; the API caps at **2,000 URLs/day**, so full coverage of the
~9k listings takes a few nights, cycling stalest-first automatically.

### Reading the results

```sql
select coverage_state, count(*)
from public.page_index_status
group by coverage_state order by count(*) desc;
```

- `Submitted and indexed` — good.
- `Crawled - currently not indexed` — Google crawled it and judged it not worth
  indexing → **thin content** (the menu-seeding + internal-linking work targets this).
- `Discovered - currently not indexed` — crawl-budget/discovery → sitemap +
  internal links help.
- `Duplicate…` / non-self canonical — canonicalization to fix.
