/**
 * The ONE definition of each "listing basics" predicate, shared by the three
 * surfaces that judge listing completeness: the dashboard setup checklist
 * (lib/onboarding.ts), the advertising unlock gate (lib/promotion-gate.ts),
 * and best-of ranking's completeness tie-breaker (lib/ranking.ts). They drifted
 * apart once already — promotion-gate accepted an empty `{}` hours blob that
 * the checklist rejected — so new completeness checks belong here, not inline.
 */

/** A listing "has hours" once at least one day has an open time. */
export function hoursSet(hours: unknown): boolean {
  if (!hours || typeof hours !== 'object') return false;
  return Object.values(hours as Record<string, unknown>).some(
    (h) => !!h && typeof h === 'object' && !!(h as { open?: string }).open,
  );
}
