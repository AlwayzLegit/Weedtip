import type { OperatingHours } from '@weedtip/shared';
import { DAY_ORDER, dayLabel } from '@/lib/format';
import { US_STATES } from '@/lib/seo';

interface ShopFacts {
  name: string;
  city: string | null;
  state: string;
  county?: string | null;
  is_pickup: boolean;
  is_delivery: boolean;
  is_medical: boolean;
  is_recreational: boolean;
  license_number?: string | null;
}

/**
 * Directory-style About paragraph assembled from verified listing facts, used
 * when the shop hasn't written its own description (the vast majority of
 * unclaimed listings). States only what the record supports — services,
 * license, market, hours cadence — so every sentence stays true per listing.
 */
export function generatedAbout(d: ShopFacts, hours: OperatingHours | null): string {
  const stateName = US_STATES[d.state] ?? d.state;
  const place = d.city ? `${d.city}, ${stateName}` : stateName;

  const audience =
    d.is_medical && d.is_recreational
      ? 'serving both medical patients and recreational customers'
      : d.is_medical
        ? 'serving medical patients'
        : d.is_recreational
          ? 'serving recreational customers 21+'
          : '';

  const service =
    d.is_pickup && d.is_delivery
      ? 'with in-store pickup and local delivery'
      : d.is_delivery && !d.is_pickup
        ? `delivering across ${d.county ? `${d.county} County` : 'its local area'}`
        : 'with in-store shopping';

  const sentences: string[] = [
    `${d.name} is a licensed cannabis ${d.is_delivery && !d.is_pickup ? 'delivery service' : 'dispensary'} ${d.city ? `in ${place}` : `operating in ${place}`}${audience ? `, ${audience}` : ''} ${service}.`.replace(/\s+/g, ' '),
  ];

  const openDays = hours ? DAY_ORDER.filter((day) => hours[day]) : [];
  if (openDays.length === 7) {
    sentences.push('The shop is open seven days a week.');
  } else if (openDays.length >= 1) {
    sentences.push(
      `The shop is open ${openDays.length} days a week (${dayLabel(openDays[0]!)}–${dayLabel(openDays[openDays.length - 1]!)}).`,
    );
  }

  if (d.license_number) {
    sentences.push(
      `It operates under ${stateName} cannabis license #${d.license_number}, verified against the state registry.`,
    );
  }

  return sentences.join(' ');
}
