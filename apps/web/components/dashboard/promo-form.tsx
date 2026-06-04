'use client';

import { useActionState } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { upsertPromo } from '@/app/actions/promos';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';
import { Checkbox, Field } from '@/components/dashboard/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function PromoForm({ promo }: { promo: Tables<'dispensary_promos'> | null }) {
  const [state, action] = useActionState(upsertPromo, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const p = promo;

  return (
    <form action={action} className="max-w-xl space-y-4">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      {p && <input type="hidden" name="id" value={p.id} />}

      <Field label="Title" htmlFor="title" error={fe.title}>
        <Input
          id="title"
          name="title"
          maxLength={120}
          required
          defaultValue={p?.title ?? ''}
          placeholder="Veterans get 20% off"
        />
      </Field>

      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={p?.description ?? ''}
          placeholder="Details — claimed in-store, ask a budtender."
        />
      </Field>

      <Field label="Image URL" htmlFor="image_url" error={fe.image_url} hint="Optional banner image">
        <Input id="image_url" name="image_url" defaultValue={p?.image_url ?? ''} placeholder="https://" />
      </Field>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" htmlFor="start_date" error={fe.start_date} hint="Optional">
          <Input id="start_date" name="start_date" type="date" defaultValue={p?.start_date ?? ''} />
        </Field>
        <Field label="End date" htmlFor="end_date" error={fe.end_date} hint="Optional">
          <Input id="end_date" name="end_date" type="date" defaultValue={p?.end_date ?? ''} />
        </Field>
      </section>

      <Field label="Sort order" htmlFor="sort_order" error={fe.sort_order} hint="Lower shows first">
        <Input
          id="sort_order"
          name="sort_order"
          type="number"
          min="0"
          max="999"
          defaultValue={p?.sort_order ?? 0}
        />
      </Field>

      <Checkbox name="is_active" label="Active" defaultChecked={p?.is_active ?? true} />

      <SubmitButton size="lg">{p ? 'Save promo' : 'Add promo'}</SubmitButton>
    </form>
  );
}
