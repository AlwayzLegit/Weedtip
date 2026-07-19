'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signIn, type AuthState } from '@/app/actions/auth';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FormMessage } from './form-message';
import { OAuthButtons } from './oauth-buttons';
import { SubmitButton } from './submit-button';

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4">
      <OAuthButtons next={next} />
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage state={state} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-primary -m-2 p-2 text-xs hover:underline">
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
        {/* Keep the return path when bouncing to sign-up — losing it strands
            claim-funnel visitors on the homepage after registration. */}
        <Link
          href={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}
          className="text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
