import type { Metadata } from 'next';
import Link from 'next/link';
import { ClaimButtons } from '@/components/admin/claim-buttons';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ownership claims · Admin' };

export default async function AdminClaims() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from('ownership_requests')
    .select(
      'id, status, message, license_number, created_at, dispensary:dispensaries(name,slug,city,state), requester:profiles(display_name)',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

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
                  {r.license_number && (
                    <p className="mt-2 text-sm">
                      <span className="text-muted">License #</span> {r.license_number}
                    </p>
                  )}
                  {r.message && <p className="text-muted mt-1 text-sm">“{r.message}”</p>}
                </div>
                <ClaimButtons id={r.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
