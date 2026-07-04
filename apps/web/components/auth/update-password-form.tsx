'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { updatePassword, type AuthState } from '@/app/actions/auth';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FormMessage } from './form-message';
import { SubmitButton } from './submit-button';

export function UpdatePasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <SubmitButton className="w-full" size="lg">
        Update password
      </SubmitButton>
      {state.message && (
        <p className="text-muted text-center text-sm">
          <Link href="/account" className="text-primary hover:underline">
            Back to your account
          </Link>
        </p>
      )}
    </form>
  );
}
