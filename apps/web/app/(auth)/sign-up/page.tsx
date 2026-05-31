import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { getAuth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign up' };

export default async function SignUpPage() {
  const { user } = await getAuth();
  if (user) redirect('/');

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Create your account</h1>
      <p className="text-muted mb-6 text-sm">Join Weedtip to save favorites and order.</p>
      <SignUpForm />
    </div>
  );
}
