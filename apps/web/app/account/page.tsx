import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteAccountButton } from '@/components/account/delete-account-button';
import { ProfileForm } from '@/components/account/profile-form';
import { getAuth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Profile' };

export default async function AccountPage() {
  const { user, profile } = await getAuth();
  // Layout guarantees auth; profile is created by the signup trigger.
  if (!user || !profile) return null;

  return (
    <div className="space-y-10">
      <ProfileForm profile={profile} email={user.email ?? ''} />

      <section className="rounded-card border-border max-w-md border p-4">
        <h2 className="text-sm font-semibold">Password</h2>
        <p className="text-muted mt-1 text-sm">
          Change the password you use to sign in to Weedtip.
        </p>
        <Link
          href="/account/update-password"
          className="text-primary mt-3 inline-block text-sm hover:underline"
        >
          Update password →
        </Link>
      </section>

      <section className="border-danger/30 rounded-card max-w-md border p-4">
        <h2 className="text-danger text-sm font-semibold">Danger zone</h2>
        <p className="text-muted mt-1 text-sm">
          Permanently delete your account and associated data. This cannot be undone.
        </p>
        <div className="mt-3">
          <DeleteAccountButton />
        </div>
      </section>
    </div>
  );
}
