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

/**
 * Factual FAQ set assembled from the same verified listing facts. Adds unique,
 * per-shop content depth (and FAQPage structured data) to listing pages — most
 * of which are unclaimed shops with no owner description or menu, and were thin
 * on word count. Every answer states only what the record supports.
 */
export function dispensaryFaqs(
  d: ShopFacts,
  hours: OperatingHours | null,
  opts: { hasMenu?: boolean } = {},
): { question: string; answer: string }[] {
  const stateName = US_STATES[d.state] ?? d.state;
  const place = d.city ? `${d.city}, ${stateName}` : stateName;
  const faqs: { question: string; answer: string }[] = [];

  const svc =
    d.is_pickup && d.is_delivery
      ? 'both in-store pickup and local delivery'
      : d.is_delivery && !d.is_pickup
        ? 'cannabis delivery'
        : 'in-store pickup';
  faqs.push({
    question: `Does ${d.name} offer pickup or delivery?`,
    answer: `${d.name} offers ${svc} in ${place}. Options can change, so check the listing above for what's currently available before you visit.`,
  });

  const type =
    d.is_medical && d.is_recreational
      ? `${d.name} serves both recreational customers 21 and older and registered medical patients`
      : d.is_medical
        ? `${d.name} is a medical dispensary serving registered patients`
        : `${d.name} is a recreational dispensary serving adults 21 and older`;
  faqs.push({
    question: `Is ${d.name} a recreational or medical dispensary?`,
    answer: `${type}. Bring a valid government-issued photo ID${
      d.is_medical && !d.is_recreational ? ' and your medical card' : ''
    } when you shop.`,
  });

  const openDays = hours ? DAY_ORDER.filter((day) => hours[day]) : [];
  if (openDays.length > 0) {
    faqs.push({
      question: `What are ${d.name}'s hours?`,
      answer:
        openDays.length === 7
          ? `${d.name} is open seven days a week. The Hours section above shows each day's opening and closing times in the shop's local time.`
          : `${d.name} is open ${openDays.length} ${openDays.length === 1 ? 'day' : 'days'} a week. The Hours section above lists opening and closing times for each day in the shop's local time.`,
    });
  }

  faqs.push({
    question: `How do I order from ${d.name} on Weedtip?`,
    answer: opts.hasMenu
      ? `Browse ${d.name}'s live menu above, add items to your cart, and check out for ${
          d.is_delivery && !d.is_pickup ? 'delivery' : 'pickup'
        }. You pay the dispensary directly — Weedtip never charges your card.`
      : `${d.name} hasn't published its menu on Weedtip yet. You can still see its address, hours, and contact details above, and check back soon for live products and deals.`,
  });

  faqs.push({
    question: `Where is ${d.name} located?`,
    answer: `${d.name} is in ${place}${
      d.county ? `, in ${d.county} County` : ''
    }. Use the map and directions on this page to get there.`,
  });

  if (d.license_number) {
    faqs.push({
      question: `Is ${d.name} a licensed dispensary?`,
      answer: `Yes — ${d.name} operates under ${stateName} cannabis license #${d.license_number}, verified against the state's public licensing registry.`,
    });
  }

  return faqs;
}
