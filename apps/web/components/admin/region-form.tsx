'use client';

import { useActionState } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { upsertRegion } from '@/app/admin/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Checkbox, Field } from '../dashboard/field';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

export function RegionForm({ region }: { region: Tables<'operating_regions'> | null }) {
  const [state, action] = useActionState(upsertRegion, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const r = region;

  return (
    <form action={action} className="max-w-md space-y-4">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      <Field label="State" htmlFor="state" error={fe.state} hint="2-letter code">
        <Input
          id="state"
          name="state"
          maxLength={2}
          defaultValue={r?.state ?? ''}
          readOnly={!!r}
          required
          className={r ? 'opacity-70' : undefined}
        />
      </Field>
      <div className="flex flex-wrap gap-4">
        <Checkbox
          name="is_recreational_legal"
          label="Recreational legal"
          defaultChecked={r?.is_recreational_legal ?? false}
        />
        <Checkbox
          name="is_medical_legal"
          label="Medical legal"
          defaultChecked={r?.is_medical_legal ?? false}
        />
      </div>
      <Field label="Minimum age" htmlFor="min_age" error={fe.min_age}>
        <Input
          id="min_age"
          name="min_age"
          type="number"
          min="18"
          max="25"
          defaultValue={r?.min_age ?? 21}
        />
      </Field>
      <Field label="Notes" htmlFor="notes" error={fe.notes}>
        <Textarea id="notes" name="notes" defaultValue={r?.notes ?? ''} rows={2} />
      </Field>
      <SubmitButton size="lg">{r ? 'Save region' : 'Add region'}</SubmitButton>
    </form>
  );
}
