'use client';

import { useActionState } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { upsertBrand } from '@/app/admin/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Field } from '../dashboard/field';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

export function BrandForm({ brand }: { brand: Tables<'brands'> | null }) {
  const [state, action] = useActionState(upsertBrand, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const b = brand;

  return (
    <form action={action} className="max-w-md space-y-4">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      {b && <input type="hidden" name="id" value={b.id} />}
      <Field label="Name" htmlFor="name" error={fe.name}>
        <Input id="name" name="name" defaultValue={b?.name ?? ''} required />
      </Field>
      <Field label="Slug" htmlFor="slug" error={fe.slug} hint="Blank = auto from name">
        <Input id="slug" name="slug" defaultValue={b?.slug ?? ''} />
      </Field>
      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={b?.description ?? ''}
          rows={3}
        />
      </Field>
      <Field label="Logo URL" htmlFor="logo_url" error={fe.logo_url}>
        <Input
          id="logo_url"
          name="logo_url"
          defaultValue={b?.logo_url ?? ''}
          placeholder="https://"
        />
      </Field>
      <Field label="Website" htmlFor="website" error={fe.website}>
        <Input id="website" name="website" defaultValue={b?.website ?? ''} placeholder="https://" />
      </Field>
      <SubmitButton size="lg">{b ? 'Save brand' : 'Add brand'}</SubmitButton>
    </form>
  );
}
