'use client';

import { useActionState, useState } from 'react';
import { createPlacement } from '@/app/admin/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Field } from '../dashboard/field';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { DispensaryPicker } from './dispensary-picker';

const TYPE_LABELS: Record<string, string> = {
  featured: 'Featured (boost in search & city pages)',
  hero: 'Homepage hero spotlight',
  promoted_deal: 'Promoted deal',
  promoted_product: 'Promoted product',
};

export function PlacementForm() {
  const [state, action] = useActionState(createPlacement, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const [type, setType] = useState('featured');
  const needsTarget = type === 'promoted_deal' || type === 'promoted_product';

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Dispensary" htmlFor="dispensary_id" error={fe.dispensary_id}>
          <DispensaryPicker />
        </Field>
        <Field label="Placement type" htmlFor="type" error={fe.type}>
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      {needsTarget && (
        <Field
          label="Target ID"
          htmlFor="target_id"
          error={fe.target_id}
          hint="UUID of the deal or product to promote."
        >
          <Input id="target_id" name="target_id" placeholder="00000000-0000-0000-0000-000000000000" />
        </Field>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Scope state"
          htmlFor="scope_state"
          error={fe.scope_state}
          hint="2-letter code, or blank for nationwide."
        >
          <Input id="scope_state" name="scope_state" maxLength={2} placeholder="CA" />
        </Field>
        <Field
          label="Scope city"
          htmlFor="scope_city"
          error={fe.scope_city}
          hint="Blank = whole state / nationwide."
        >
          <Input id="scope_city" name="scope_city" placeholder="Los Angeles" />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Priority"
          htmlFor="priority"
          error={fe.priority}
          hint="Higher ranks first."
        >
          <Input id="priority" name="priority" type="number" min="0" defaultValue={0} />
        </Field>
        <Field label="Price ($)" htmlFor="price" error={fe.price_cents} hint="What they paid.">
          <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={0} />
        </Field>
        <Field label="Starts" htmlFor="starts_at" error={fe.starts_at}>
          <Input id="starts_at" name="starts_at" type="datetime-local" />
        </Field>
      </section>

      <Field
        label="Ends"
        htmlFor="ends_at"
        error={fe.ends_at}
        hint="Leave blank for an open-ended placement."
      >
        <Input id="ends_at" name="ends_at" type="datetime-local" />
      </Field>

      <Field label="Notes" htmlFor="notes" error={fe.notes}>
        <Textarea id="notes" name="notes" rows={2} />
      </Field>

      <SubmitButton size="lg">Create placement</SubmitButton>
    </form>
  );
}
