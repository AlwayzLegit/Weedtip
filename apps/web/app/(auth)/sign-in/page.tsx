import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/auth/sign-in-form';
import { getAuth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : undefined;

  const { user } = await getAuth();
  if (user) redirect(safeNext ?? '/');

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Welcome back</h1>
      <p className="text-muted mb-6 text-sm">Sign in to your Weedtip account.</p>
      <SignInForm next={safeNext} />
    </div>
  );
}
