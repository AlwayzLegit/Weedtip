'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { sendPasswordReset, type AuthState } from '@/app/actions/auth';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FormMessage } from './form-message';
import { SubmitButton } from './submit-button';

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(sendPasswordReset, {});

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <SubmitButton className="w-full" size="lg">
        Send reset link
      </SubmitButton>
      <p className="text-muted text-center text-sm">
        Remembered it?{' '}
        <Link href="/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
