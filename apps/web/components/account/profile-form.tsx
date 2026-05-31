'use client';

import { useActionState } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { updateProfile } from '@/app/account/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Field } from '../dashboard/field';
import { Input } from '../ui/input';

export function ProfileForm({ profile, email }: { profile: Tables<'profiles'>; email: string }) {
  const [state, action] = useActionState(updateProfile, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="max-w-md space-y-4">
      <FormMessage
        state={{
          error: state.status === 'error' ? state.message : undefined,
          message: state.status === 'success' ? state.message : undefined,
        }}
      />
      <Field
        label="Email"
        htmlFor="email"
        hint="Managed by your login — contact support to change."
      >
        <Input id="email" value={email} disabled />
      </Field>
      <Field label="Display name" htmlFor="display_name" error={fe.display_name}>
        <Input id="display_name" name="display_name" defaultValue={profile.display_name ?? ''} />
      </Field>
      <Field label="Avatar URL" htmlFor="avatar_url" error={fe.avatar_url}>
        <Input
          id="avatar_url"
          name="avatar_url"
          defaultValue={profile.avatar_url ?? ''}
          placeholder="https://"
        />
      </Field>
      <Field
        label="Date of birth"
        htmlFor="date_of_birth"
        error={fe['date_of_birth']}
        hint="Used for age verification (21+)."
      >
        <Input
          id="date_of_birth"
          name="date_of_birth"
          type="date"
          defaultValue={profile.date_of_birth ?? ''}
        />
      </Field>
      <SubmitButton size="lg">Save profile</SubmitButton>
    </form>
  );
}
