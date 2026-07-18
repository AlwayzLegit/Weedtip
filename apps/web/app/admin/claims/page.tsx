import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandClaimButtons } from '@/components/admin/brand-claim-buttons';
import { ClaimButtons } from '@/components/admin/claim-buttons';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ownership claims · Admin' };

export default async function AdminClaims() {
  const supabase = await createClient();
  const [{ data: requests }, { data: brandClaims }] = await Promise.all([
    supabase
      .from('ownership_requests')
      .select(
        'id, status, message, license_number, license_match, email_domain_match, document_path, claimant_role, business_email, business_phone, plan_preference, created_at, dispensary:dispensaries(name,slug,city,state), requester:profiles(display_name)',
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('brand_claims')
      .select('id, message, created_at, brand:brands(name,slug), requester:profiles(display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  // Sign each uploaded document so admins can open it (bucket is private; the
  // "read own or admin" RLS policy lets this admin session generate the link).
  const docUrls = new Map<string, string>();
  await Promise.all(
    (requests ?? [])
      .filter((r) => r.document_path)
      .map(async (r) => {
        const { data } = await supabase.storage
          .from('claim-documents')
          .createSignedUrl(r.document_path as string, 60 * 10);
        if (data?.signedUrl) docUrls.set(r.id, data.signedUrl);
      }),
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Ownership claims</h2>
      <p className="text-muted text-sm">
        Dispensary owners requesting to manage an unclaimed listing. Approving attaches the listing
        to their account and declines any competing claims.
      </p>

      {!requests || requests.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No pending ownership claims.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const dispensary = r.dispensary as {
              name: string;
              slug: string;
              city: string;
              state: string;
            } | null;
            const requester = r.requester as { display_name: string | null } | null;
            return (
              <div
                key={r.id}
                className="rounded-card border-border bg-surface flex flex-col gap-3 border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {dispensary ? (
                      <Link
                        href={`/dispensary/${dispensary.slug}`}
                        className="hover:text-primary font-medium"
                      >
                        {dispensary.name}
                      </Link>
                    ) : (
                      <span className="font-medium">Unknown listing</span>
                    )}
                    {dispensary && (
                      <span className="text-muted text-xs">
                        {dispensary.city}, {dispensary.state}
                      </span>
                    )}
                  </div>
                  <p className="text-muted mt-1 text-xs">
                    Requested by {requester?.display_name ?? 'an owner'} ·{' '}
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-muted mt-1 text-xs">
                    {r.claimant_role
                      ? { owner: 'Owner', manager: 'Manager', authorized_rep: 'Authorized rep' }[
                          r.claimant_role as 'owner' | 'manager' | 'authorized_rep'
                        ]
                      : 'Role not given'}
                    {r.business_email ? ` · ${r.business_email}` : ''}
                    {r.business_phone ? ` · ${r.business_phone}` : ''}
                  </p>
                  {(() => {
                    const hasDoc = !!r.document_path;
                    const signals =
                      (r.license_match ? 1 : 0) + (r.email_domain_match ? 1 : 0) + (hasDoc ? 1 : 0);
                    const strong = r.license_match && r.email_domain_match;
                    const strength = signals === 0 ? 'weak' : strong ? 'strong' : 'moderate';
                    const strengthClass = {
                      strong: 'border-primary/30 bg-primary-muted text-primary',
                      moderate:
                        'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                      weak: 'border-danger/40 bg-danger/10 text-danger',
                    }[strength];
                    return (
                      <div className="mt-2 space-y-1.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${strengthClass}`}
                        >
                          {strength} verification
                        </span>
                        {/* Sales signal: the plan they picked while claiming. */}
                        {r.plan_preference && r.plan_preference !== 'free' && (
                          <span className="border-primary/30 bg-primary-muted text-primary ml-1.5 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                            wants {r.plan_preference}
                            {r.plan_preference === 'growth' ? ' · $99/mo' : ' · $29/mo'}
                          </span>
                        )}
                        <ul className="text-xs">
                          <li>
                            <span className={r.license_match ? 'text-primary' : 'text-muted'}>
                              {r.license_match ? '✓' : '○'}
                            </span>{' '}
                            License{' '}
                            {r.license_number ? (
                              <span className="font-mono">{r.license_number}</span>
                            ) : (
                              'not provided'
                            )}
                            {r.license_number &&
                              (r.license_match
                                ? ' — matches state record'
                                : ' — no match on file')}
                          </li>
                          <li>
                            <span className={r.email_domain_match ? 'text-primary' : 'text-muted'}>
                              {r.email_domain_match ? '✓' : '○'}
                            </span>{' '}
                            Business email{' '}
                            {r.email_domain_match
                              ? 'on the listing’s own domain'
                              : 'not on the listing’s domain'}
                          </li>
                          <li>
                            <span className={hasDoc ? 'text-primary' : 'text-muted'}>
                              {hasDoc ? '✓' : '○'}
                            </span>{' '}
                            {hasDoc ? (
                              docUrls.get(r.id) ? (
                                <a
                                  href={docUrls.get(r.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary font-medium hover:underline"
                                >
                                  View uploaded document
                                </a>
                              ) : (
                                'Document uploaded (link unavailable)'
                              )
                            ) : (
                              'No document uploaded'
                            )}
                          </li>
                        </ul>
                      </div>
                    );
                  })()}
                  {r.message && <p className="text-muted mt-2 text-sm">“{r.message}”</p>}
                </div>
                <ClaimButtons
                  id={r.id}
                  weak={!r.license_match && !r.email_domain_match && !r.document_path}
                />
              </div>
            );
          })}
        </div>
      )}

      <h2 className="pt-4 text-2xl font-bold">Brand claims</h2>
      <p className="text-muted text-sm">
        Owners requesting to manage a brand. Approving assigns the brand to their account and
        declines competing claims.
      </p>
      {!brandClaims || brandClaims.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No pending brand claims.
        </div>
      ) : (
        <div className="space-y-3">
          {brandClaims.map((c) => {
            const brand = c.brand as { name: string; slug: string } | null;
            const requester = c.requester as { display_name: string | null } | null;
            return (
              <div
                key={c.id}
                className="rounded-card border-border bg-surface flex flex-col gap-3 border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  {brand ? (
                    <Link href={`/brand/${brand.slug}`} className="hover:text-primary font-medium">
                      {brand.name}
                    </Link>
                  ) : (
                    <span className="font-medium">Unknown brand</span>
                  )}
                  <p className="text-muted mt-1 text-xs">
                    Requested by {requester?.display_name ?? 'an owner'} ·{' '}
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                  {c.message && <p className="text-muted mt-1 text-sm">“{c.message}”</p>}
                </div>
                <BrandClaimButtons id={c.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
