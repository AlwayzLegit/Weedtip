'use server';

import type { OperatingHours } from '@weedtip/shared';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin console: match unlinked listings to Google Places (Text Search, New).
 * Ports packages/supabase/scripts/enrich-from-google.py into the app so the
 * API key never leaves the server environment. Each verified match writes
 * google_place_id, the first photo reference, the live-photo cover URL, and
 * fills phone/website/hours only where ours are null. Every attempted row is
 * stamped google_enriched_at so unmatched listings aren't re-billed.
 */

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.regularOpeningHours',
  'places.photos',
].join(',');

const STOP_WORDS = new Set([
  'the', 'inc', 'llc', 'co', 'corp', 'cannabis', 'dispensary', 'weed', 'shop',
  'collective', 'wellness', 'center', 'centre', 'group', 'healing', 'holistic',
  'care', 'supply', 'club', 'organics', 'organic', 'gardens', 'garden', 'health',
  'company', 'store', 'retail', 'delivery', 'and', 'of',
]);

function nameTokens(s: string | null): Set<string> {
  return new Set(
    (s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type GooglePeriodPoint = { day: number; hour: number; minute: number };
type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: { periods?: { open: GooglePeriodPoint; close?: GooglePeriodPoint }[] };
  photos?: { name: string }[];
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const hhmm = (p: GooglePeriodPoint) =>
  `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;

function toHours(periods: { open: GooglePeriodPoint; close?: GooglePeriodPoint }[]): OperatingHours {
  const hours = Object.fromEntries(DAY_KEYS.map((d) => [d, null])) as OperatingHours;
  for (const p of periods) {
    const key = DAY_KEYS[p.open.day];
    if (key) hours[key] = { open: hhmm(p.open), close: p.close ? hhmm(p.close) : '23:59' };
  }
  return hours;
}

export type EnrichBatchResult =
  | {
      ok: true;
      processed: number;
      matched: number;
      unmatched: number;
      failed: number;
      remaining: number;
    }
  | { ok: false; error: string };

const BATCH = 40;
const CONCURRENCY = 5;

export async function enrichFromGoogleBatch(): Promise<EnrichBatchResult> {
  await requireAdmin();
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { ok: false, error: 'GOOGLE_PLACES_API_KEY is not configured here.' };

  const supabase = await createClient();
  // Only rows we can verify: coordinates are required for the proximity check.
  const { data: rows } = await supabase
    .from('dispensaries')
    .select('id,slug,name,city,state,latitude,longitude,phone,website,hours')
    .is('google_place_id', null)
    .is('google_enriched_at', null)
    .not('location', 'is', null)
    .eq('status', 'active')
    .order('state')
    .limit(BATCH);

  const batch = rows ?? [];
  let matched = 0;
  let unmatched = 0;
  let failed = 0;

  async function processOne(d: (typeof batch)[number]): Promise<void> {
    const query = [d.name, d.city, d.state].filter(Boolean).join(', ');
    try {
      const res = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key as string,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: query,
          locationBias: {
            circle: {
              center: { latitude: d.latitude, longitude: d.longitude },
              radius: 2000,
            },
          },
          maxResultCount: 3,
        }),
        cache: 'no-store',
      });
      if (!res.ok) {
        failed += 1;
        return;
      }
      const json = (await res.json()) as { places?: Place[] };
      const ours = nameTokens(d.name);
      const sharedTokens = (p: Place) => {
        const theirs = nameTokens(p.displayName?.text ?? '');
        return [...ours].filter((t) => theirs.has(t)).length;
      };
      let hit = (json.places ?? []).find((p) => {
        if (!p.location) return false;
        const dist = haversineMeters(
          d.latitude as number,
          d.longitude as number,
          p.location.latitude,
          p.location.longitude,
        );
        if (dist > 150) return false;
        return sharedTokens(p) >= 1;
      });

      // Many seed rows carry centroid-grade geocodes, so the 150m gate misses
      // real matches. Fallback: same city+state in Google's address AND a
      // strong (≥2 shared token) name match. Google's coordinates are the
      // trustworthy ones here — adopt them.
      let adoptGoogleLocation = false;
      if (!hit && d.city && d.state) {
        const city = d.city.toLowerCase();
        const state = d.state.toUpperCase();
        hit = (json.places ?? []).find((p) => {
          if (!p.location || !p.formattedAddress) return false;
          const addr = p.formattedAddress.toLowerCase();
          if (!addr.includes(city)) return false;
          if (!new RegExp(`\\b${state}\\b`).test(p.formattedAddress)) return false;
          return sharedTokens(p) >= 2;
        });
        adoptGoogleLocation = Boolean(hit);
      }

      if (!hit) {
        unmatched += 1;
        await supabase
          .from('dispensaries')
          .update({ google_enriched_at: new Date().toISOString() })
          .eq('id', d.id);
        return;
      }

      const photo = hit.photos?.[0]?.name ?? null;
      // All references (capped) power the profile-page photo gallery.
      const photoNames = (hit.photos ?? []).slice(0, 8).map((p) => p.name);
      const periods = hit.regularOpeningHours?.periods;
      await supabase
        .from('dispensaries')
        .update({
          google_place_id: hit.id,
          google_enriched_at: new Date().toISOString(),
          ...(photo ? { google_photo_name: photo, cover_image_url: `/api/dispensary-cover/${d.slug}` } : {}),
          ...(photoNames.length ? { google_photo_names: photoNames } : {}),
          // Address-verified fallback: replace our centroid-grade point with
          // Google's premise coordinates (EWKT for the geography column).
          ...(adoptGoogleLocation && hit.location
            ? { location: `SRID=4326;POINT(${hit.location.longitude} ${hit.location.latitude})` }
            : {}),
          // Fill contact/hours only where we have nothing — never overwrite.
          ...(!d.phone && hit.nationalPhoneNumber ? { phone: hit.nationalPhoneNumber } : {}),
          ...(!d.website && hit.websiteUri ? { website: hit.websiteUri } : {}),
          ...(!d.hours && periods?.length ? { hours: toHours(periods) } : {}),
        })
        .eq('id', d.id);
      matched += 1;
    } catch {
      failed += 1;
    }
  }

  // Bounded concurrency to stay well inside the action's execution window.
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    await Promise.all(batch.slice(i, i + CONCURRENCY).map(processOne));
  }

  const { count } = await supabase
    .from('dispensaries')
    .select('id', { count: 'exact', head: true })
    .is('google_place_id', null)
    .is('google_enriched_at', null)
    .not('location', 'is', null)
    .eq('status', 'active');

  return {
    ok: true,
    processed: batch.length,
    matched,
    unmatched,
    failed,
    remaining: count ?? 0,
  };
}

export type PhotoBackfillResult =
  | { ok: true; processed: number; withPhotos: number; noPhotos: number; failed: number; remaining: number }
  | { ok: false; error: string };

const PHOTO_BATCH = 60;
const PHOTO_CONCURRENCY = 8;

/**
 * Backfill photo galleries for listings enriched before google_photo_names
 * existed: one Place Details (photos field) call per already-matched place_id.
 * Rows with no photos get an empty array so they're never re-billed. Also
 * fills the single cover reference + cover URL where those are still missing.
 */
export async function backfillPhotoGalleriesBatch(): Promise<PhotoBackfillResult> {
  await requireAdmin();
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { ok: false, error: 'GOOGLE_PLACES_API_KEY is not configured here.' };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('dispensaries')
    .select('id,slug,google_place_id,google_photo_name,cover_image_url')
    .not('google_place_id', 'is', null)
    .is('google_photo_names', null)
    .eq('status', 'active')
    .limit(PHOTO_BATCH);

  const batch = rows ?? [];
  let withPhotos = 0;
  let noPhotos = 0;
  let failed = 0;

  async function processOne(d: (typeof batch)[number]): Promise<void> {
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${d.google_place_id}`, {
        headers: { 'X-Goog-Api-Key': key as string, 'X-Goog-FieldMask': 'photos' },
        cache: 'no-store',
      });
      if (!res.ok) {
        // A dead place_id would fail forever — stamp it done with no photos.
        if (res.status === 404) {
          noPhotos += 1;
          await supabase.from('dispensaries').update({ google_photo_names: [] }).eq('id', d.id);
          return;
        }
        failed += 1;
        return;
      }
      const json = (await res.json()) as { photos?: { name: string }[] };
      const names = (json.photos ?? []).slice(0, 8).map((p) => p.name);
      await supabase
        .from('dispensaries')
        .update({
          google_photo_names: names,
          ...(names[0] && !d.google_photo_name ? { google_photo_name: names[0] } : {}),
          ...(names[0] && !d.cover_image_url
            ? { cover_image_url: `/api/dispensary-cover/${d.slug}` }
            : {}),
        })
        .eq('id', d.id);
      if (names.length > 0) withPhotos += 1;
      else noPhotos += 1;
    } catch {
      failed += 1;
    }
  }

  for (let i = 0; i < batch.length; i += PHOTO_CONCURRENCY) {
    await Promise.all(batch.slice(i, i + PHOTO_CONCURRENCY).map(processOne));
  }

  const { count } = await supabase
    .from('dispensaries')
    .select('id', { count: 'exact', head: true })
    .not('google_place_id', 'is', null)
    .is('google_photo_names', null)
    .eq('status', 'active');

  return { ok: true, processed: batch.length, withPhotos, noPhotos, failed, remaining: count ?? 0 };
}
