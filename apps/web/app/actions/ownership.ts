'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { claimSubmittedEmail, SALES_INBOX, sendEmail } from '@/lib/email';
import { formError, formSuccess, fromZodError, str, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

const claimSchema = z.object({
  dispensary_id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  claimant_role: z.enum(['owner', 'manager', 'authorized_rep']),
  business_email: z.string().email('Enter a valid business email').max(254),
  business_phone: z.string().max(30).nullable(),
  message: z.string().max(2000).nullable(),
  license_number: z.string().max(120).nullable(),
  document_path: z.string().max(400).nullable(),
  /** Tier-based funnel: starting plan picked with the claim (default free). */
  plan_preference: z.enum(['free', 'basic', 'growth']).default('free'),
});

/** Loose license comparison: case/spacing/punctuation insensitive. */
function normalizeLicense(v: string | null | undefined): string {
  return (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Registrable domain of an email or URL, lowercased, without a leading `www.`.
 * Used to check whether a claimant's business email lives on the dispensary's
 * own web domain — a strong, hard-to-fake proof-of-control signal.
 */
function domainOf(value: string | null | undefined): string {
  if (!value) return '';
  let host = value.trim().toLowerCase();
  const at = host.lastIndexOf('@');
  if (at !== -1) host = host.slice(at + 1);
  host = host.replace(/^https?:\/\//, '').replace(/^www\./, '');
  // Strip any path, query, fragment, or port — keep just the host.
  host = host.replace(/[/?#:].*$/, '');
  return host;
}

/**
 * A dispensary_owner requests to claim an unclaimed, active listing. The DB's RLS
 * insert policy is the real gate (owner role + listing unclaimed & active); this
 * action validates input and surfaces a friendly message. Owners can re-submit
 * after a rejection (prior non-approved request is cleared first).
 */
export async function requestOwnership(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, profile } = await getAuth();
  if (!user) return formError('Please sign in to claim a listing.');
  if (profile?.role !== 'dispensary_owner') {
    return formError('Only dispensary-owner accounts can claim a listing.');
  }

  const parsed = claimSchema.safeParse({
    dispensary_id: str(fd, 'dispensary_id') ?? '',
    slug: str(fd, 'slug') ?? '',
    claimant_role: str(fd, 'claimant_role') ?? '',
    business_email: str(fd, 'business_email') ?? '',
    business_phone: str(fd, 'business_phone') ?? null,
    message: str(fd, 'message') ?? null,
    license_number: str(fd, 'license_number') ?? null,
    document_path: str(fd, 'document_path') ?? null,
    plan_preference: str(fd, 'plan_preference') ?? 'free',
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();

  // Claims are verified against the license on file — listings imported without
  // a license number can't be claimed until it's backfilled. (RLS enforces this
  // too; checking here surfaces a clear message instead of a policy error.)
  const { data: target } = await supabase
    .from('dispensaries')
    .select('name, license_number, website, email, dcc_email')
    .eq('id', parsed.data.dispensary_id)
    .maybeSingle();
  if (!target?.license_number) {
    return formError(
      'This listing can’t be claimed yet — we don’t have its state license on file to verify against. Check back soon.',
    );
  }

  // Clear any prior non-approved request so a rejected owner can re-submit.
  await supabase
    .from('ownership_requests')
    .delete()
    .eq('dispensary_id', parsed.data.dispensary_id)
    .eq('user_id', user.id);

  // The strongest self-serve signal an admin has: does the license the claimer
  // typed match the state record on file?
  const licenseMatch =
    !!parsed.data.license_number &&
    normalizeLicense(parsed.data.license_number) === normalizeLicense(target.license_number);

  // Second control signal: is the claimant's business email on the dispensary's
  // own domain (its website, public email, or the state-registered contact)?
  // Someone with a real @theshop.com address almost certainly works there.
  const claimDomain = domainOf(parsed.data.business_email);
  const shopDomains = new Set(
    [domainOf(target.website), domainOf(target.email), domainOf(target.dcc_email)].filter(Boolean),
  );
  const emailDomainMatch = claimDomain.length > 0 && shopDomains.has(claimDomain);

  // Only trust a document path that lands in this user's own upload folder — the
  // bucket's RLS enforces this too, but never persist a path we can't attribute.
  const documentPath =
    parsed.data.document_path && parsed.data.document_path.startsWith(`${user.id}/`)
      ? parsed.data.document_path
      : null;

  const { error } = await supabase.from('ownership_requests').insert({
    dispensary_id: parsed.data.dispensary_id,
    user_id: user.id,
    claimant_role: parsed.data.claimant_role,
    business_email: parsed.data.business_email,
    business_phone: parsed.data.business_phone,
    message: parsed.data.message,
    license_number: parsed.data.license_number,
    license_match: licenseMatch,
    email_domain_match: emailDomainMatch,
    document_path: documentPath,
    plan_preference: parsed.data.plan_preference,
  });

  if (error) {
    return formError(
      error.code === '42501' || error.code === 'PGRST301'
        ? 'This listing can no longer be claimed.'
        : error.message,
    );
  }

  // Best-effort notifications: claimant ack + heads-up to the team inbox.
  {
    const ack = claimSubmittedEmail(target.name);
    await sendEmail({ to: parsed.data.business_email, subject: ack.subject, html: ack.html });
    const strength =
      licenseMatch || emailDomainMatch || documentPath
        ? licenseMatch && emailDomainMatch
          ? 'STRONG'
          : 'moderate'
        : 'WEAK — no automatic signals';
    await sendEmail({
      to: SALES_INBOX,
      subject: `[Claims] New ownership claim — ${target.name}`,
      html: `<p>${parsed.data.business_email} claimed <strong>${target.name}</strong>.</p>
<ul>
<li>License match: ${licenseMatch ? 'YES' : 'no'}</li>
<li>Email-domain match: ${emailDomainMatch ? 'YES' : 'no'}</li>
<li>Document uploaded: ${documentPath ? 'yes' : 'no'}</li>
<li>Verification strength: <strong>${strength}</strong></li>
<li>Plan interest: <strong>${parsed.data.plan_preference.toUpperCase()}</strong>${
        parsed.data.plan_preference === 'growth'
          ? ' ($99/mo)'
          : parsed.data.plan_preference === 'basic'
            ? ' ($29/mo)'
            : ''
      }</li>
</ul>
<p>Review in /admin/claims.</p>`,
    });
  }

  revalidatePath(`/dispensary/${parsed.data.slug}`);
  return formSuccess('Claim submitted — an admin will review it shortly.');
}

/** Owner withdraws their own (not-yet-approved) claim. RLS enforces author + status. */
export async function withdrawOwnership(dispensaryId: string, slug: string): Promise<void> {
  const { user } = await getAuth();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from('ownership_requests')
    .delete()
    .eq('dispensary_id', dispensaryId)
    .eq('user_id', user.id);
  revalidatePath(`/dispensary/${slug}`);
}
