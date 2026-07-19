'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signUp, type AuthState } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FormMessage } from './form-message';
import { OAuthButtons } from './oauth-buttons';
import { SubmitButton } from './submit-button';

type Persona = 'consumer' | 'dispensary_owner' | 'brand';

export function SignUpForm({
  defaultRole = 'consumer',
  next,
}: {
  defaultRole?: Persona;
  next?: string;
}) {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});
  const [persona, setPersona] = useState<Persona>(defaultRole);

  // Brand owners have no role of their own (ownership is via brands.owner_id), so
  // they register as consumers and carry their intent into the brand flow via next.
  const role = persona === 'brand' ? 'consumer' : persona;
  const nextValue = persona === 'brand' ? '/for-brands' : next;

  return (
    <form action={action} className="space-y-4">
      {/* OAuth can't carry the dispensary_owner role in metadata (the profile
          trigger would default them to consumer), so Google is offered for the
          shopper/brand personas only — owners keep the email path. */}
      {role === 'consumer' && <OAuthButtons next={nextValue} />}
      <FormMessage state={state} />

      <input type="hidden" name="role" value={role} />
      {nextValue && <input type="hidden" name="next" value={nextValue} />}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { value: 'consumer', label: 'Shopping' },
            { value: 'dispensary_owner', label: 'I own a shop' },
            { value: 'brand', label: 'I’m a brand' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPersona(opt.value)}
            className={cn(
              'rounded-lg border px-2 py-2 text-center text-sm font-medium transition-colors',
              persona === opt.value
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
        {/* Carry the return path across — an invited owner who already has an
            account must land back on THEIR listing after signing in. */}
        <Link
          href={nextValue ? `/sign-in?next=${encodeURIComponent(nextValue)}` : '/sign-in'}
          className="text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
