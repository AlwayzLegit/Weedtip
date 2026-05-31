'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signIn, type AuthState } from '@/app/actions/auth';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FormMessage } from './form-message';
import { SubmitButton } from './submit-button';

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage state={state} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-primary text-xs hover:underline">
            Forgot?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <SubmitButton className="w-full" size="lg">
        Sign in
      </SubmitButton>
      <p className="text-muted text-center text-sm">
        New to Weedtip?{' '}
        <Link href="/sign-up" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
