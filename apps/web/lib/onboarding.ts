import type { Database } from '@weedtip/supabase/types';
import { hoursSet } from './listing-completeness';

type Dispensary = Database['public']['Tables']['dispensaries']['Row'];

export interface SetupStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  href: string;
  cta: string;
  /**
   * Pro-gated for THIS owner. Locked steps render with an upgrade chip and are
   * excluded from the progress denominator — a free owner must be able to reach
   * 100% with what the free plan actually lets them edit, otherwise the
   * checklist reads as permanently unfinished instead of as an upsell.
   */
  locked?: boolean;
}

/** The entitlements that decide which checklist steps this owner can act on. */
export type SetupEntitlements = {
  completeProfile: boolean;
  deals: boolean;
  bulkImport: boolean;
};

/**
 * The guided-setup checklist for a claimed listing. Order is roughly the
 * activation priority: identity (logo/cover) → discoverability (hours,
 * description, amenities) → the money-maker (menu) → engagement (a deal).
 */
export function setupSteps(
  d: Dispensary,
  counts: { products: number; deals: number },
  entitlements: SetupEntitlements = { completeProfile: true, deals: true, bulkImport: true },
): SetupStep[] {
  return [
    {
      key: 'logo',
      label: 'Add your logo',
      hint: 'Your brand mark shows on your listing, cards, and the map.',
      done: !!d.logo_url,
      href: '/dashboard/listing',
      cta: 'Upload logo',
    },
    {
      key: 'cover',
      label: 'Add a cover photo',
      hint: 'A storefront or hero image makes your page look claimed and cared-for.',
      done: !!d.cover_image_url,
      href: '/dashboard/listing',
      cta: 'Upload cover',
    },
    {
      key: 'hours',
      label: 'Set your hours',
      hint: 'Shoppers filter by "Open now" — no hours means you get filtered out.',
      done: hoursSet(d.hours),
      href: '/dashboard/listing',
      cta: 'Set hours',
    },
    {
      key: 'description',
      label: 'Write an About section',
      hint: 'Tell shoppers who you are — it also helps you rank in search.',
      done: !!d.description && d.description.trim().length >= 20,
      href: '/dashboard/listing',
      cta: 'Add description',
      locked: !entitlements.completeProfile,
    },
    {
      key: 'amenities',
      label: 'List your amenities',
      hint: 'ATM, curbside, accessibility, payment types — these drive filter matches.',
      done: Array.isArray(d.amenities) && d.amenities.length > 0,
      href: '/dashboard/listing',
      cta: 'Add amenities',
      locked: !entitlements.completeProfile,
    },
    {
      key: 'menu',
      label: 'Add your menu',
      // Manual product entry is free; CSV/POS import is Pro. Point the CTA at
      // whichever door is actually open for this owner.
      hint: entitlements.bulkImport
        ? 'Import a CSV or connect your POS — a full menu is what shoppers come for.'
        : 'Add your products one by one — a full menu is what shoppers come for.',
      done: counts.products > 0,
      href: entitlements.bulkImport ? '/dashboard/products/import' : '/dashboard/products/new',
      cta: entitlements.bulkImport ? 'Import menu' : 'Add products',
    },
    {
      key: 'deal',
      label: 'Run your first deal',
      hint: 'Deals earn a badge on your card and a spot in the Deals filter.',
      done: counts.deals > 0,
      href: '/dashboard/deals/new',
      cta: 'Create deal',
      locked: !entitlements.deals,
    },
  ];
}

/**
 * Progress over the steps this owner can actually complete. Locked steps don't
 * count against the percentage (they're the upsell, not the homework), but a
 * locked step an admin already finished still shows as done in the list.
 */
export function setupProgress(steps: SetupStep[]): { done: number; total: number; pct: number } {
  const actionable = steps.filter((s) => !s.locked);
  const done = actionable.filter((s) => s.done).length;
  const total = actionable.length;
  return { done, total, pct: total === 0 ? 100 : Math.round((done / total) * 100) };
}
