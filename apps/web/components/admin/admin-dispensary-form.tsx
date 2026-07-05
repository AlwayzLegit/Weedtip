'use client';

import { useActionState } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { adminUpdateDispensary } from '@/app/admin/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Checkbox, Field } from '../dashboard/field';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

/** Admin data editor — the raw registry fields, no owner-facing frills. */
export function AdminDispensaryForm({ dispensary: d }: { dispensary: Tables<'dispensaries'> }) {
  const [state, action] = useActionState(adminUpdateDispensary, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={d.id} />
      <FormMessage
        state={{
          error: state.status === 'error' ? state.message : undefined,
          message: state.status === 'success' ? state.message : undefined,
        }}
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={d.name} required />
        </Field>
        <Field label="Legal name" htmlFor="legal_name" error={fe.legal_name}>
          <Input id="legal_name" name="legal_name" defaultValue={d.legal_name ?? ''} />
        </Field>
        <Field label="License #" htmlFor="license_number" error={fe.license_number}>
          <Input id="license_number" name="license_number" defaultValue={d.license_number ?? ''} />
        </Field>
        <Field label="County" htmlFor="county" error={fe.county}>
          <Input id="county" name="county" defaultValue={d.county ?? ''} />
        </Field>
      </section>

      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea id="description" name="description" defaultValue={d.description ?? ''} rows={3} />
      </Field>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Address" htmlFor="address" error={fe.address}>
          <Input id="address" name="address" defaultValue={d.address ?? ''} />
        </Field>
        <Field label="City" htmlFor="city" error={fe.city}>
          <Input id="city" name="city" defaultValue={d.city ?? ''} />
        </Field>
        <Field label="State" htmlFor="state" error={fe.state} hint="2-letter code">
          <Input id="state" name="state" maxLength={2} defaultValue={d.state} required />
        </Field>
        <Field label="ZIP" htmlFor="zip" error={fe.zip}>
          <Input id="zip" name="zip" defaultValue={d.zip ?? ''} />
        </Field>
        <Field label="Latitude" htmlFor="latitude" error={fe['location.lat']}>
          <Input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            defaultValue={d.latitude ?? ''}
          />
        </Field>
        <Field
          label="Longitude"
          htmlFor="longitude"
          error={fe['location.lng']}
          hint="Set both, or leave both blank to keep the current point."
        >
          <Input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            defaultValue={d.longitude ?? ''}
          />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone" htmlFor="phone" error={fe.phone}>
          <Input id="phone" name="phone" defaultValue={d.phone ?? ''} />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" defaultValue={d.email ?? ''} />
        </Field>
        <Field label="Website" htmlFor="website" error={fe.website}>
          <Input id="website" name="website" defaultValue={d.website ?? ''} placeholder="https://" />
        </Field>
      </section>

      <fieldset className="rounded-card border-border border p-4">
        <legend className="px-1 text-sm font-medium">Offerings</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          <Checkbox
            name="is_recreational"
            label="Recreational"
            defaultChecked={d.is_recreational}
          />
          <Checkbox name="is_medical" label="Medical" defaultChecked={d.is_medical} />
          <Checkbox name="is_pickup" label="Pickup" defaultChecked={d.is_pickup} />
          <Checkbox name="is_delivery" label="Delivery" defaultChecked={d.is_delivery} />
        </div>
      </fieldset>

      <SubmitButton size="lg">Save listing</SubmitButton>
    </form>
  );
}
