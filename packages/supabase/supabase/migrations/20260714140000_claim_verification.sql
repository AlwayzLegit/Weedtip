-- ════════════════════════════════════════════════════════════════════════════
-- 20260714140000_claim_verification
--
-- Hardens dispensary-ownership claims (regulated industry: the wrong person
-- must not be able to take over a licensed shop's page). Adds two proof-of-
-- control signals beyond the existing self-reported license-number match:
--
--   • email_domain_match — the claimant's business email is on the same domain
--     as the dispensary's public website (auto-computed at claim time). A shop
--     email on the shop's own domain is a strong control signal.
--   • document_path — an uploaded state license / business document (private
--     `claim-documents` bucket; admins read via signed URL) so approval is
--     evidence-based, not blind.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.ownership_requests
  add column if not exists email_domain_match boolean not null default false,
  add column if not exists document_path text;

-- Private bucket for claim evidence (NOT public — no public URL).
insert into storage.buckets (id, name, public)
values ('claim-documents', 'claim-documents', false)
on conflict (id) do nothing;

-- Claimants upload only under their own <uid>/ folder.
drop policy if exists "claim docs upload own" on storage.objects;
create policy "claim docs upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'claim-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read is limited to the uploader (to preview their own) and admins (to review).
drop policy if exists "claim docs read own or admin" on storage.objects;
create policy "claim docs read own or admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'claim-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Uploader may replace/remove their own pending upload.
drop policy if exists "claim docs modify own" on storage.objects;
create policy "claim docs modify own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'claim-documents' and owner = auth.uid())
  with check (bucket_id = 'claim-documents' and owner = auth.uid());

drop policy if exists "claim docs delete own" on storage.objects;
create policy "claim docs delete own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'claim-documents' and owner = auth.uid());
