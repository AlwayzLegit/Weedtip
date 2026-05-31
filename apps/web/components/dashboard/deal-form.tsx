'use client';

import { useActionState } from 'react';
import { DISCOUNT_TYPES } from '@weedtip/shared';
import type { Tables } from '@weedtip/supabase/types';
import { upsertDeal } from '@/app/dashboard/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Checkbox, Field } from './field';

const DISCOUNT_LABELS: Record<string, string> = {
  percentage: 'Percentage off',
  fixed: 'Fixed amount off',
  bogo: 'Buy one get one',
};

/** ISO → "YYYY-MM-DDTHH:mm" for datetime-local inputs. */
function toLocalInput(iso: string | undefined): string {
  return iso ? iso.slice(0, 16) : '';
}

export function DealForm({ deal }: { deal: Tables<'deals'> | null }) {
  const [state, action] = useActionState(upsertDeal, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const d = deal;

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      {d && <input type="hidden" name="id" value={d.id} />}

      <Field label="Title" htmlFor="title" error={fe.title}>
        <Input id="title" name="title" defaultValue={d?.title ?? ''} required />
      </Field>

      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={d?.description ?? ''}
          rows={2}
        />
      </Field>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Discount type" htmlFor="discount_type" error={fe.discount_type}>
          <Select
            id="discount_type"
            name="discount_type"
            defaultValue={d?.discount_type ?? 'percentage'}
          >
            {DISCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DISCOUNT_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Discount value"
          htmlFor="discount_value"
          error={fe.discount_value}
          hint="Percent (≤100) or dollar amount; ignored for BOGO."
        >
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            step="0.01"
            min="0"
            defaultValue={d?.discount_value ?? ''}
          />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="start_date" error={fe.start_date}>
          <Input
            id="start_date"
            name="start_date"
            type="datetime-local"
            defaultValue={toLocalInput(d?.start_date)}
            required
          />
        </Field>
        <Field label="Ends" htmlFor="end_date" error={fe.end_date}>
          <Input
            id="end_date"
            name="end_date"
            type="datetime-local"
            defaultValue={toLocalInput(d?.end_date)}
            required
          />
        </Field>
      </section>

      <Checkbox name="is_active" label="Active" defaultChecked={d?.is_active ?? true} />

      <SubmitButton size="lg">{d ? 'Save deal' : 'Create deal'}</SubmitButton>
    </form>
  );
}
