import type { Database } from '@weedtip/supabase/types';

type Dispensary = Database['public']['Tables']['dispensaries']['Row'];

export interface SetupStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  href: string;
  cta: string;
}

/** A dispensary counts as "has hours" once at least one day has an open time. */
function hoursSet(hours: Dispensary['hours']): boolean {
  if (!hours || typeof hours !== 'object') return false;
  return Object.values(hours as Record<string, unknown>).some(
    (h) => !!h && typeof h === 'object' && !!(h as { open?: string }).open,
  );
}

/**
 * The guided-setup checklist for a claimed listing. Order is roughly the
 * activation priority: identity (logo/cover) → discoverability (hours,
 * description, amenities) → the money-maker (menu) → engagement (a deal).
 */
export function setupSteps(
  d: Dispensary,
  counts: { products: number; deals: number },
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
    },
    {
      key: 'amenities',
      label: 'List your amenities',
      hint: 'ATM, curbside, accessibility, payment types — these drive filter matches.',
      done: Array.isArray(d.amenities) && d.amenities.length > 0,
      href: '/dashboard/listing',
      cta: 'Add amenities',
    },
    {
      key: 'menu',
      label: 'Add your menu',
      hint: 'Import a CSV or connect your POS — a full menu is what shoppers come for.',
      done: counts.products > 0,
      href: '/dashboard/products/import',
      cta: 'Import menu',
    },
    {
      key: 'deal',
      label: 'Run your first deal',
      hint: 'Deals earn a badge on your card and a spot in the Deals filter.',
      done: counts.deals > 0,
      href: '/dashboard/deals/new',
      cta: 'Create deal',
    },
  ];
}

export function setupProgress(steps: SetupStep[]): { done: number; total: number; pct: number } {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
}
