import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { getAuth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign up' };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const { role, next } = await searchParams;
  const safeNext = typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : undefined;
  const defaultRole = role === 'dispensary_owner' ? 'dispensary_owner' : 'consumer';

  const { user } = await getAuth();
  if (user) redirect(safeNext ?? '/');

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">
        {defaultRole === 'dispensary_owner' ? 'Claim your dispensary' : 'Create your account'}
      </h1>
      <p className="text-muted mb-6 text-sm">
        {defaultRole === 'dispensary_owner'
          ? 'Create a free business account, then submit your claim — we verify it against the state license on file.'
          : 'Join Weedtip to save favorites and order.'}
      </p>
      <SignUpForm defaultRole={defaultRole} next={safeNext} />
    </div>
  );
}
