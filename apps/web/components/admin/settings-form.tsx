'use client';

import { useActionState } from 'react';
import { updatePlatformSettings } from '@/app/admin/settings/actions';
import type { Tables } from '@weedtip/supabase/types';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { SubmitButton } from '../auth/submit-button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

function Field({
  name,
  label,
  defaultValue,
  type = 'text',
  hint,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ''} required={required} />
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

/** Editor for the single-row platform_settings — brand + contact source of truth. */
export function SettingsForm({ settings }: { settings: Tables<'platform_settings'> }) {
  const [state, action] = useActionState(updatePlatformSettings, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Brand</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="brand_name" label="Brand name" defaultValue={settings.brand_name} required />
          <Field name="legal_name" label="Legal name" defaultValue={settings.legal_name} />
          <Field name="tagline" label="Tagline" defaultValue={settings.tagline} />
          <div>
            <Label htmlFor="brand_color">Brand color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                defaultValue={settings.brand_color}
                onChange={(e) => {
                  const t = document.getElementById('brand_color') as HTMLInputElement | null;
                  if (t) t.value = e.target.value;
                }}
                className="border-border h-11 w-12 shrink-0 cursor-pointer rounded-lg border bg-transparent"
                aria-label="Pick brand color"
              />
              <Input id="brand_color" name="brand_color" defaultValue={settings.brand_color} />
            </div>
            <p className="text-muted mt-1 text-xs">Used in email templates. Hex, e.g. #1a7f4e.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Contact inboxes</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="support_email" label="Support email" type="email" defaultValue={settings.support_email} required />
          <Field name="sales_email" label="Sales email" type="email" defaultValue={settings.sales_email} required />
          <Field name="ads_email" label="Ads email" type="email" defaultValue={settings.ads_email} required />
          <Field name="privacy_email" label="Privacy email" type="email" defaultValue={settings.privacy_email} required />
          <Field
            name="email_from"
            label="Email “From”"
            defaultValue={settings.email_from}
            hint="Sender identity for all outgoing mail, e.g. Weedtip <notifications@weedtip.com>."
            required
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Phone &amp; address</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="phone_display" label="Phone (display)" defaultValue={settings.phone_display} hint="e.g. (747) 250-4446" />
          <Field name="phone_e164" label="Phone (tel: link)" defaultValue={settings.phone_e164} hint="E.164 digits, e.g. +17472504446" />
          <Field name="address_line" label="Address (one line)" defaultValue={settings.address_line} hint="Shown in the footer + emails." />
          <Field name="address_locality" label="City" defaultValue={settings.address_locality} />
          <Field name="address_region" label="State" defaultValue={settings.address_region} />
          <Field name="postal_code" label="ZIP" defaultValue={settings.postal_code} />
          <Field name="country" label="Country (2-letter)" defaultValue={settings.country} />
        </div>
      </section>

      {state.status === 'error' && state.message && (
        <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
          {state.message}
        </p>
      )}
      {state.status === 'success' && (
        <p className="border-primary/40 bg-primary-muted text-primary rounded-lg border px-3 py-2 text-sm">
          {state.message}
        </p>
      )}

      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
