'use client';

import { useActionState } from 'react';
import { AMENITY_GROUPS, AMENITY_LABELS, type OperatingHours } from '@weedtip/shared';
import type { Tables } from '@weedtip/supabase/types';
import { upsertDispensary } from '@/app/dashboard/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { DAY_ORDER, dayLabel } from '@/lib/format';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Checkbox, Field } from './field';
import { ImageUpload } from './image-upload';

export function ListingForm({ dispensary }: { dispensary: Tables<'dispensaries'> | null }) {
  const [state, action] = useActionState(upsertDispensary, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const d = dispensary;
  const hours = (d?.hours as OperatingHours | null) ?? null;
  const amenities = new Set(d?.amenities ?? []);

  return (
    <form action={action} className="space-y-6">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={d?.name ?? ''} required />
        </Field>
        <Field
          label="URL slug"
          htmlFor="slug"
          error={fe.slug}
          hint="Leave blank to auto-generate from the name."
        >
          <Input id="slug" name="slug" defaultValue={d?.slug ?? ''} placeholder="green-leaf-nyc" />
        </Field>
      </section>

      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={d?.description ?? ''}
          rows={3}
        />
      </Field>

      <Field
        label="Announcement"
        htmlFor="announcement"
        error={fe.announcement}
        hint="A short banner pinned to the top of your listing (deals, holiday hours, etc.). Leave blank to hide."
      >
        <Textarea
          id="announcement"
          name="announcement"
          defaultValue={d?.announcement ?? ''}
          rows={2}
          maxLength={500}
        />
      </Field>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Address"
          htmlFor="address"
          error={fe.address}
          hint="Recommended — shown on your listing."
        >
          <Input id="address" name="address" defaultValue={d?.address ?? ''} />
        </Field>
        <Field label="City" htmlFor="city" error={fe.city}>
          <Input id="city" name="city" defaultValue={d?.city ?? ''} />
        </Field>
        <Field label="State" htmlFor="state" error={fe.state} hint="2-letter code, e.g. NY">
          <Input id="state" name="state" maxLength={2} defaultValue={d?.state ?? ''} required />
        </Field>
        <Field label="ZIP" htmlFor="zip" error={fe.zip}>
          <Input id="zip" name="zip" defaultValue={d?.zip ?? ''} />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Latitude"
          htmlFor="latitude"
          error={fe['location.lat']}
          hint="Decimal degrees — needed to appear on the map and in nearby search."
        >
          <Input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            defaultValue={d?.latitude ?? ''}
          />
        </Field>
        <Field
          label="Longitude"
          htmlFor="longitude"
          error={fe['location.lng']}
          hint="Decimal degrees — set both, or leave both blank."
        >
          <Input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            defaultValue={d?.longitude ?? ''}
          />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone" htmlFor="phone" error={fe.phone}>
          <Input id="phone" name="phone" defaultValue={d?.phone ?? ''} />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" defaultValue={d?.email ?? ''} />
        </Field>
        <Field label="Website" htmlFor="website" error={fe.website}>
          <Input
            id="website"
            name="website"
            defaultValue={d?.website ?? ''}
            placeholder="https://"
          />
        </Field>
        <ImageUpload
          bucket="dispensary-media"
          name="logo_url"
          label="Logo"
          defaultUrl={d?.logo_url}
        />
        <ImageUpload
          bucket="dispensary-media"
          name="cover_image_url"
          label="Cover image"
          defaultUrl={d?.cover_image_url}
        />
        <Field label="License #" htmlFor="license_number" error={fe.license_number}>
          <Input id="license_number" name="license_number" defaultValue={d?.license_number ?? ''} />
        </Field>
      </section>

      <fieldset className="rounded-card border-border border p-4">
        <legend className="px-1 text-sm font-medium">Offerings</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          <Checkbox
            name="is_recreational"
            label="Recreational"
            defaultChecked={d?.is_recreational ?? true}
          />
          <Checkbox name="is_medical" label="Medical" defaultChecked={d?.is_medical ?? false} />
          <Checkbox name="is_pickup" label="Pickup" defaultChecked={d?.is_pickup ?? true} />
          <Checkbox name="is_delivery" label="Delivery" defaultChecked={d?.is_delivery ?? false} />
        </div>
      </fieldset>

      <fieldset className="rounded-card border-border border p-4">
        <legend className="px-1 text-sm font-medium">Features &amp; amenities</legend>
        <p className="text-muted mb-3 text-xs">
          Highlight ownership, accessibility, payments, discounts, and amenities — these power the
          finder filters.
        </p>
        <div className="space-y-4">
          {AMENITY_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.items.map((a) => (
                  <Checkbox
                    key={a}
                    name="amenities"
                    value={a}
                    label={AMENITY_LABELS[a]}
                    defaultChecked={amenities.has(a)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-card border-border border p-4">
        <legend className="px-1 text-sm font-medium">Hours</legend>
        <p className="text-muted mb-3 text-xs">
          Leave both blank for a closed day. 24-hour format.
        </p>
        <div className="space-y-2">
          {DAY_ORDER.map((day) => (
            <div key={day} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
              <span className="text-muted text-sm">{dayLabel(day)}</span>
              <Input
                type="time"
                name={`hours_${day}_open`}
                defaultValue={hours?.[day]?.open ?? ''}
                aria-label={`${day} open`}
              />
              <Input
                type="time"
                name={`hours_${day}_close`}
                defaultValue={hours?.[day]?.close ?? ''}
                aria-label={`${day} close`}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-card border-border border p-4">
        <legend className="px-1 text-sm font-medium">Pickup profile</legend>
        <p className="text-muted mb-3 text-xs">
          Set expectations for pickup orders — shown on your listing and after a shopper checks out.
        </p>
        <div className="space-y-4">
          <Checkbox
            name="require_id"
            label="Require a valid ID at pickup"
            defaultChecked={d?.require_id ?? false}
          />
          <Field
            label="Post-order message"
            htmlFor="post_order_message"
            error={fe.post_order_message}
            hint="Shown to the shopper on their order confirmation (e.g. parking, entrance, wait time). Max 250 characters."
          >
            <Textarea
              id="post_order_message"
              name="post_order_message"
              defaultValue={d?.post_order_message ?? ''}
              rows={2}
              maxLength={250}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton size="lg">{d ? 'Save changes' : 'Create listing'}</SubmitButton>
        {d && <span className="text-muted text-sm">Status is managed by Weedtip admins.</span>}
      </div>
    </form>
  );
}
