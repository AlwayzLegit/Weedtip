import 'server-only';
import { redirect } from 'next/navigation';
import { getAuth } from './auth';

/**
 * Gate admin-only pages. Redirects unauthenticated users to sign-in and
 * non-admins home. RLS is still the source of truth for every admin write.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const { user, profile } = await getAuth();
  if (!user) redirect('/sign-in');
  if (profile?.role !== 'admin') redirect('/');
  return { userId: user.id };
}
