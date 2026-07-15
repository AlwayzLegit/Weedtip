import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { acceptInvite } from '@/app/dashboard/team/actions';
import { SubmitButton } from '@/components/auth/submit-button';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Your invites', robots: { index: false } };

/**
 * Where an invited teammate accepts. Reachable by any signed-in user (a pending
 * invitee has no dashboard access yet), scoped by RLS + email to their invites.
 */
export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await getAuth();
  if (!user) redirect('/sign-in?next=/invites');
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: invites } = await supabase
    .from('dispensary_members')
    .select('id, role, dispensary:dispensaries(name, slug)')
    .eq('status', 'pending')
    .eq('email', (user.email ?? '').toLowerCase());

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Users className="text-primary h-6 w-6" /> Team invites
      </h1>
      {error && (
        <p className="border-danger/40 bg-danger/10 text-danger mt-4 rounded-lg border px-3 py-2 text-sm">
          That invite couldn’t be accepted — it may have been revoked.
        </p>
      )}

      {!invites || invites.length === 0 ? (
        <p className="text-muted mt-4 text-sm">
          You have no pending invites. If you were invited, make sure you signed in with the email
          address it was sent to.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {invites.map((inv) => {
            const shop = inv.dispensary as { name: string; slug: string } | null;
            return (
              <div
                key={inv.id}
                className="rounded-card border-border bg-surface flex items-center justify-between gap-3 border p-4"
              >
                <div>
                  <p className="font-medium">{shop?.name ?? 'A dispensary'}</p>
                  <p className="text-muted text-sm capitalize">Role: {inv.role}</p>
                </div>
                <form action={acceptInvite.bind(null, inv.id)}>
                  <SubmitButton size="sm">Accept</SubmitButton>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
