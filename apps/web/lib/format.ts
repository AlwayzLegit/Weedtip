import { METERS_PER_MILE, type OperatingHours } from '@weedtip/shared';

/** Cents → "$45.00". */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** Meters → "0.3 mi" / "12 mi". */
export function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  const miles = meters / METERS_PER_MILE;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

const DAY_LABELS: Record<keyof OperatingHours, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const DAY_ORDER: (keyof OperatingHours)[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export function dayLabel(day: keyof OperatingHours): string {
  return DAY_LABELS[day];
}

/** "9:00 AM" from "09:00". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h! >= 12 ? 'PM' : 'AM';
  const hour12 = h! % 12 === 0 ? 12 : h! % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Short badge label for a deal's discount, covering every deal kind the
 * dashboard can create (percentage, fixed_amount, price_target,
 * spend_threshold, bogo) plus the legacy `fixed` value. Returns a generic
 * "Special" instead of a misleading "$0 off" when no numeric value applies —
 * e.g. a set-price/category promo whose amount lives in the title.
 */
export function dealBadge(type: string, value: number): string {
  switch (type) {
    case 'percentage':
      return value > 0 ? `${value}% off` : 'Special';
    case 'fixed':
    case 'fixed_amount':
      return value > 0 ? `$${value} off` : 'Special';
    case 'price_target':
      return value > 0 ? `$${value}` : 'Special';
    case 'spend_threshold':
      return value > 0 ? `${value}% off order` : 'Special';
    case 'bogo':
      return 'BOGO';
    default:
      return 'Special';
  }
}
