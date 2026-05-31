import type { Metadata } from 'next';
import { ProfileForm } from '@/components/account/profile-form';
import { getAuth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Profile' };

export default async function AccountPage() {
  const { user, profile } = await getAuth();
  // Layout guarantees auth; profile is created by the signup trigger.
  if (!user || !profile) return null;

  return <ProfileForm profile={profile} email={user.email ?? ''} />;
}
