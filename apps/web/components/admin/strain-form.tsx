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
      <Field
        label="Terpenes"
        htmlFor="terpenes"
        error={fe.terpenes}
        hint="e.g. Myrcene, Limonene, Pinene"
      >
        <Textarea
          id="terpenes"
          name="terpenes"
          defaultValue={(s?.terpenes ?? []).join(', ')}
          rows={2}
        />
      </Field>
      <Field
        label="Negative effects"
        htmlFor="negative_effects"
        error={fe.negative_effects}
        hint="e.g. Dry mouth, Dizzy"
      >
        <Textarea
          id="negative_effects"
          name="negative_effects"
          defaultValue={(s?.negative_effects ?? []).join(', ')}
          rows={2}
        />
      </Field>
      <Field
        label="Medical uses"
        htmlFor="medical_uses"
        error={fe.medical_uses}
        hint="e.g. Stress, Anxiety, Insomnia"
      >
        <Textarea
          id="medical_uses"
          name="medical_uses"
          defaultValue={(s?.medical_uses ?? []).join(', ')}
          rows={2}
        />
      </Field>
      <Field
        label="Parent strains"
        htmlFor="parents"
        error={fe.parents}
        hint="Genetics — comma separated"
      >
        <Input id="parents" name="parents" defaultValue={(s?.parents ?? []).join(', ')} />
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
        <Field label="CBD low %" htmlFor="cbd_low" error={fe.cbd_low}>
          <Input
            id="cbd_low"
            name="cbd_low"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={s?.cbd_low ?? ''}
          />
        </Field>
        <Field label="CBD high %" htmlFor="cbd_high" error={fe.cbd_high}>
          <Input
            id="cbd_high"
            name="cbd_high"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={s?.cbd_high ?? ''}
          />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Grow difficulty" htmlFor="grow_difficulty" error={fe.grow_difficulty}>
          <Input
            id="grow_difficulty"
            name="grow_difficulty"
            defaultValue={s?.grow_difficulty ?? ''}
            placeholder="Easy / Moderate / Hard"
          />
        </Field>
        <Field
          label="Flowering min (days)"
          htmlFor="flowering_days_min"
          error={fe.flowering_days_min}
        >
          <Input
            id="flowering_days_min"
            name="flowering_days_min"
            type="number"
            min="0"
            max="365"
            defaultValue={s?.flowering_days_min ?? ''}
          />
        </Field>
        <Field
          label="Flowering max (days)"
          htmlFor="flowering_days_max"
          error={fe.flowering_days_max}
        >
          <Input
            id="flowering_days_max"
            name="flowering_days_max"
            type="number"
            min="0"
            max="365"
            defaultValue={s?.flowering_days_max ?? ''}
          />
        </Field>
      </section>

      <Field label="Yield note" htmlFor="yield_note" error={fe.yield_note}>
        <Input
          id="yield_note"
          name="yield_note"
          defaultValue={s?.yield_note ?? ''}
          placeholder="e.g. High — up to 500g/m²"
        />
      </Field>
      <Field label="Grow notes" htmlFor="grow_notes" error={fe.grow_notes}>
        <Textarea id="grow_notes" name="grow_notes" defaultValue={s?.grow_notes ?? ''} rows={3} />
      </Field>

      <SubmitButton size="lg">{s ? 'Save strain' : 'Add strain'}</SubmitButton>
    </form>
  );
}
