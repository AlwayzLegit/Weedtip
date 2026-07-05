'use server';

import { revalidatePath } from 'next/cache';
import type { OperatingHours } from '@weedtip/shared';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

type GooglePeriodPoint = { day: number; hour: number; minute: number };
type GooglePlaceDetails = {
  nationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: {
    periods?: { open: GooglePeriodPoint; close?: GooglePeriodPoint }[];
  };
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function hhmm(p: GooglePeriodPoint): string {
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Google periods (day 0 = Sunday) → our per-day OperatingHours shape. */
function toOperatingHours(
  periods: { open: GooglePeriodPoint; close?: GooglePeriodPoint }[],
): OperatingHours {
  const hours = Object.fromEntries(DAY_KEYS.map((d) => [d, null])) as OperatingHours;
  for (const p of periods) {
    const key = DAY_KEYS[p.open.day];
    if (!key) continue;
    hours[key] = {
      open: hhmm(p.open),
      // A period without a close means open 24 hours that day.
      close: p.close ? hhmm(p.close) : '23:59',
    };
  }
  return hours;
}

export type GoogleSyncResult = { ok: true; updated: string[] } | { ok: false; error: string };

/**
 * One-click import of hours, phone, and website from the listing's linked
 * Google Business Profile (via the Places Details API). Owner- or admin-only
 * through requireOwnerDispensary; overwrites those three fields by design —
 * Google is treated as the fresher source when the owner asks for a sync.
 */
export async function syncFromGoogle(): Promise<GoogleSyncResult> {
  const { dispensary } = await requireOwnerDispensary();

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return { ok: false, error: 'Google sync is not configured on this environment yet.' };
  }
  if (!dispensary.google_place_id) {
    return {
      ok: false,
      error:
        'This listing isn’t linked to a Google Business Profile yet — ask support to link it, or make sure your Google listing matches this address.',
    };
  }

  const res = await fetch(`https://places.googleapis.com/v1/places/${dispensary.google_place_id}`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'nationalPhoneNumber,websiteUri,regularOpeningHours',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, error: 'Google didn’t return this listing’s details. Try again shortly.' };
  }
  const place = (await res.json()) as GooglePlaceDetails;

  const patch: {
    last_google_sync: string;
    phone?: string;
    website?: string;
    hours?: OperatingHours;
  } = { last_google_sync: new Date().toISOString() };
  const updated: string[] = [];
  if (place.nationalPhoneNumber) {
    patch.phone = place.nationalPhoneNumber;
    updated.push('phone');
  }
  if (place.websiteUri) {
    patch.website = place.websiteUri;
    updated.push('website');
  }
  const periods = place.regularOpeningHours?.periods;
  if (periods && periods.length > 0) {
    patch.hours = toOperatingHours(periods);
    updated.push('hours');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('dispensaries').update(patch).eq('id', dispensary.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/google');
  revalidatePath('/dashboard/listing');
  revalidatePath(`/dispensary/${dispensary.slug}`);
  return { ok: true, updated };
}
