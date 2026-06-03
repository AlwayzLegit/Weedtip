/**
 * Placement rate card. Shared by the owner-facing Buy UI (to preview a price)
 * and the checkout server action (which recomputes authoritatively — never trust
 * a client-supplied amount). Pricing follows the competitor pattern of charging
 * by reach: broader geographic scope and higher-visibility slots cost more.
 */
import type { Database } from '@weedtip/supabase/types';

export type PlacementType = Database['public']['Enums']['placement_type'];
export type PlacementScope = 'city' | 'state' | 'nationwide';

/** Base price per day, in cents, by slot type. */
const BASE_DAILY_CENTS: Record<PlacementType, number> = {
  promoted_deal: 1000,
  promoted_product: 1000,
  featured: 1500,
  hero: 4000,
};

/** Reach multiplier — wider scope reaches more shoppers, so it costs more. */
const SCOPE_MULTIPLIER: Record<PlacementScope, number> = {
  city: 1,
  state: 3,
  nationwide: 8,
};

export const PLACEMENT_MIN_DAYS = 1;
export const PLACEMENT_MAX_DAYS = 90;

export const PLACEMENT_TYPE_LABEL: Record<PlacementType, string> = {
  featured: 'Featured placement',
  hero: 'Homepage spotlight',
  promoted_deal: 'Promoted deal',
  promoted_product: 'Promoted product',
};

export const PLACEMENT_SCOPE_LABEL: Record<PlacementScope, string> = {
  city: 'Your city',
  state: 'Statewide',
  nationwide: 'Nationwide',
};

/** Derive the scope tier from the (optional) state/city targeting. */
export function scopeOf(scopeState: string | null, scopeCity: string | null): PlacementScope {
  if (scopeCity) return 'city';
  if (scopeState) return 'state';
  return 'nationwide';
}

/** Authoritative price for a placement purchase, in cents. */
export function placementPriceCents(
  type: PlacementType,
  scope: PlacementScope,
  days: number,
): number {
  const clampedDays = Math.min(PLACEMENT_MAX_DAYS, Math.max(PLACEMENT_MIN_DAYS, Math.round(days)));
  return Math.round(BASE_DAILY_CENTS[type] * SCOPE_MULTIPLIER[scope] * clampedDays);
}
