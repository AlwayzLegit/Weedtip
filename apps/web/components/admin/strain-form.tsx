'use client';

import { useActionState } from 'react';
import { STRAIN_TYPES } from '@weedtip/shared';
import type { Tables } from '@weedtip/supabase/types';
import { upsertStrain } from '@/app/admin/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Field } from '../dashboard/field';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';

const TYPE_LABEL: Record<string, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export function StrainForm({ strain }: { strain: Tables<'strains'> | null }) {
  const [state, action] = useActionState(upsertStrain, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const s = strain;

  return (
    <form action={action} className="max-w-xl space-y-4">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      {s && <input type="hidden" name="id" value={s.id} />}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={s?.name ?? ''} required />
        </Field>
        <Field label="Slug" htmlFor="slug" error={fe.slug} hint="Blank = auto from name">
          <Input id="slug" name="slug" defaultValue={s?.slug ?? ''} />
        </Field>
      </section>

      <Field label="Type" htmlFor="type" error={fe.type}>
        <Select id="type" name="type" defaultValue={s?.type ?? 'hybrid'}>
          {STRAIN_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={s?.description ?? ''}
          rows={3}
        />
      </Field>

      <Field label="Effects" htmlFor="effects" error={fe.effects} hint="Comma or newline separated">
        <Textarea
          id="effects"
          name="effects"
          defaultValue={(s?.effects ?? []).join(', ')}
          rows={2}
        />
      </Field>
      <Field label="Flavors" htmlFor="flavors" error={fe.flavors} hint="Comma or newline separated">
        <Textarea
          id="flavors"
          name="flavors"
          defaultValue={(s?.flavors ?? []).join(', ')}
          rows={2}
        />
      </Field>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="THC low %" htmlFor="thc_low" error={fe.thc_low}>
          <Input
            id="thc_low"
            name="thc_low"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={s?.thc_low ?? ''}
          />
        </Field>
        <Field label="THC high %" htmlFor="thc_high" error={fe.thc_high}>
          <Input
            id="thc_high"
            name="thc_high"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={s?.thc_high ?? ''}
          />
        </Field>
      </section>

      <SubmitButton size="lg">{s ? 'Save strain' : 'Add strain'}</SubmitButton>
    </form>
  );
}
