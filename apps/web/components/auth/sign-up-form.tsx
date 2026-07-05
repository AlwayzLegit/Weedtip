'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signUp, type AuthState } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FormMessage } from './form-message';
import { SubmitButton } from './submit-button';

export function SignUpForm({
  defaultRole = 'consumer',
  next,
}: {
  defaultRole?: 'consumer' | 'dispensary_owner';
  next?: string;
}) {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});
  const [role, setRole] = useState<'consumer' | 'dispensary_owner'>(defaultRole);

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />

      <input type="hidden" name="role" value={role} />
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { value: 'consumer', label: 'I’m shopping' },
            { value: 'dispensary_owner', label: 'I own a shop' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRole(opt.value)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              role === opt.value
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <Label htmlFor="display_name">Name</Label>
        <Input id="display_name" name="display_name" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
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
        <Label htmlFor="date_of_birth">Date of birth</Label>
        <Input id="date_of_birth" name="date_of_birth" type="date" required />
        <p className="text-muted mt-1 text-xs">You must be 21 or older.</p>
      </div>

      <SubmitButton className="w-full" size="lg">
        Create account
      </SubmitButton>
      <p className="text-muted text-center text-sm">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
