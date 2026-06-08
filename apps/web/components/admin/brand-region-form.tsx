'use client';

import { useActionState } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { upsertBrandAdRegion } from '@/app/admin/actions';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';
import { Checkbox, Field } from '@/components/dashboard/field';
import { Input } from '@/components/ui/input';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function BrandRegionForm({ region }: { region: Tables<'brand_ad_regions'> | null }) {
  const [state, action] = useActionState(upsertBrandAdRegion, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const r = region;

  return (
    <form action={action} className="max-w-xl space-y-4">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      {r && <input type="hidden" name="id" value={r.id} />}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input
            id="name"
            name="name"
            defaultValue={r?.name ?? ''}
            required
            placeholder="CA Featured Brands"
          />
        </Field>
        <Field label="Slug" htmlFor="slug" error={fe.slug} hint="Blank = auto from name">
          <Input id="slug" name="slug" defaultValue={r?.slug ?? ''} />
        </Field>
        <Field label="State" htmlFor="state" error={fe.state} hint="One market per state">
          <Input id="state" name="state" maxLength={2} defaultValue={r?.state ?? ''} placeholder="CA" />
        </Field>
        <Field
          label="Featured rate / term ($)"
          htmlFor="rate_dollars"
          error={fe.featured_rate_cents}
          hint="Floor / rate per 2-month term"
        >
          <Input
            id="rate_dollars"
            name="rate_dollars"
            type="number"
            min="0"
            step="0.01"
            defaultValue={r ? (r.featured_rate_cents / 100).toString() : ''}
          />
        </Field>
        <Field label="Featured slots" htmlFor="slots" error={fe.slots}>
          <Input id="slots" name="slots" type="number" min="1" max="20" defaultValue={r?.slots ?? 3} />
        </Field>
      </section>

      <Checkbox name="is_active" label="Active" defaultChecked={r?.is_active ?? true} />

      <SubmitButton size="lg">{r ? 'Save market' : 'Add market'}</SubmitButton>
    </form>
  );
}
