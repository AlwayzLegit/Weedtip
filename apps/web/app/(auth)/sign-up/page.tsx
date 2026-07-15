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
  const defaultRole =
    role === 'dispensary_owner' ? 'dispensary_owner' : role === 'brand' ? 'brand' : 'consumer';

  const { user } = await getAuth();
  if (user) redirect(safeNext ?? '/');

  const heading =
    defaultRole === 'dispensary_owner'
      ? 'Claim your dispensary'
      : defaultRole === 'brand'
        ? 'Set up your brand'
        : 'Create your account';
  const subtext =
    defaultRole === 'dispensary_owner'
      ? 'Create a free business account, then submit your claim — we verify it against the state license on file.'
      : defaultRole === 'brand'
        ? 'Create a free account, then claim or create your brand to reach shoppers on every menu that carries you.'
        : 'Join Weedtip to save favorites and order.';

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{heading}</h1>
      <p className="text-muted mb-6 text-sm">{subtext}</p>
      <SignUpForm defaultRole={defaultRole} next={safeNext} />
    </div>
  );
}
