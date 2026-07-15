/**
 * Lifecycle of a deal, derived from its active flag + date window. Shared by the
 * Promo-Codes view and the Deals Schedule so both agree on what "Live" means.
 */
export type DealLifecycle = 'live' | 'scheduled' | 'expired' | 'inactive';

export function dealLifecycle(
  d: { is_active: boolean; start_date: string; end_date: string },
  now: number = Date.now(),
): DealLifecycle {
  if (!d.is_active) return 'inactive';
  const start = new Date(d.start_date).getTime();
  const end = new Date(d.end_date).getTime();
  if (end < now) return 'expired';
  if (start > now) return 'scheduled';
  return 'live';
}

export const DEAL_LIFECYCLE_LABEL: Record<DealLifecycle, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  expired: 'Expired',
  inactive: 'Inactive',
};
