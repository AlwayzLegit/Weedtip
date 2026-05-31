'use client';

import { useActionState } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { upsertCategory } from '@/app/admin/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Field } from '../dashboard/field';
import { Input } from '../ui/input';

export function CategoryForm({ category }: { category: Tables<'categories'> | null }) {
  const [state, action] = useActionState(upsertCategory, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const c = category;

  return (
    <form action={action} className="max-w-md space-y-4">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Name" htmlFor="name" error={fe.name}>
        <Input id="name" name="name" defaultValue={c?.name ?? ''} required />
      </Field>
      <Field label="Slug" htmlFor="slug" error={fe.slug} hint="Blank = auto from name">
        <Input id="slug" name="slug" defaultValue={c?.slug ?? ''} />
      </Field>
      <Field label="Icon" htmlFor="icon" error={fe.icon} hint="Lucide icon name (optional)">
        <Input id="icon" name="icon" defaultValue={c?.icon ?? ''} />
      </Field>
      <Field label="Sort order" htmlFor="sort_order" error={fe.sort_order}>
        <Input id="sort_order" name="sort_order" type="number" defaultValue={c?.sort_order ?? 0} />
      </Field>
      <SubmitButton size="lg">{c ? 'Save category' : 'Add category'}</SubmitButton>
    </form>
  );
}
