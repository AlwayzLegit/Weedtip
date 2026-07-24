'use client';

import { useActionState } from 'react';
import { upsertDispensary } from '@/app/dashboard/actions';
import { goBack } from '@/app/get-started/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { SubmitButton } from '../auth/submit-button';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

/**
 * Step 4, the other branch: the shop isn't in the directory yet.
 *
 * Kept to the handful of fields a reviewer actually needs to approve a listing
 * — the previous flow dropped owners straight into the full dashboard form
 * (fifteen fields including manual latitude/longitude) before they'd even seen
 * the product. Everything else is better filled in from the dashboard, where
 * the setup checklist walks through it against a live listing.
 */
export function CreateStep() {
  const [state, action] = useActionState(upsertDispensary, EMPTY_FORM_STATE);

  return (
    <div className="space-y-4">
      <form action={goBack}>
        <input type="hidden" name="to" value="business" />
        <Button type="submit" variant="ghost" size="sm">
          ← Back to search
        </Button>
      </form>
      <form action={action} className="space-y-4">
        <Input
          name="name"
          placeholder="Business name"
          required
          maxLength={160}
          aria-label="Business name"
        />
        <Input
          name="address"
          placeholder="Street address"
          maxLength={200}
          aria-label="Street address"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input name="city" placeholder="City" maxLength={80} aria-label="City" />
          <Input
            name="state"
            placeholder="State (e.g. CA)"
            required
            maxLength={2}
            aria-label="State"
            className="uppercase"
          />
          <Input name="zip" placeholder="ZIP" maxLength={10} aria-label="ZIP code" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            name="phone"
            placeholder="Business phone"
            maxLength={30}
            aria-label="Business phone"
          />
          <Input
            name="license_number"
            placeholder="State license #"
            maxLength={120}
            aria-label="State license number"
          />
        </div>

        <fieldset className="rounded-card border-border bg-surface-2 border p-4">
          <legend className="px-1 text-sm font-medium">How do customers get their order?</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_pickup"
                defaultChecked
                className="accent-primary h-4 w-4"
              />
              In-store pickup
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_delivery" className="accent-primary h-4 w-4" />
              Delivery
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_recreational"
                defaultChecked
                className="accent-primary h-4 w-4"
              />
              Recreational
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_medical" className="accent-primary h-4 w-4" />
              Medical
            </label>
          </div>
        </fieldset>

        <p className="text-muted text-sm">
          New listings go live after a quick review — usually the same day. You can add photos,
          hours, and your menu from the dashboard right away; none of it waits on approval.
        </p>

        {state.status === 'error' && state.message && (
          <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
            {state.message}
          </p>
        )}

        <SubmitButton size="lg">Create my listing</SubmitButton>
      </form>
    </div>
  );
}
