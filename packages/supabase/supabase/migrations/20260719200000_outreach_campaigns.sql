-- ════════════════════════════════════════════════════════════════════════════
-- 20260719200000_outreach_campaigns
-- Claim-outreach v2: market-targeted campaigns, reminder drip, registry-contact
-- reach. campaign labels each send wave; contact_source records which address
-- tier was used (public email vs the state-registry licensee contact);
-- reminder_sent_at caps the drip at ONE follow-up per invite.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.claim_invites
  add column if not exists campaign text,
  add column if not exists contact_source text not null default 'email'
    check (contact_source in ('email', 'dcc_email')),
  add column if not exists reminder_sent_at timestamptz;
