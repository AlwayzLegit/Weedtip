import type { OperatingHours } from '@weedtip/shared';
import { DAY_ORDER, dayLabel } from '@/lib/format';
import { US_STATES } from '@/lib/seo';

interface ShopFacts {
  name: string;
  city: string | null;
  state: string;
  county?: string | null;
  address?: string | null;
  is_pickup: boolean;
  is_delivery: boolean;
  is_medical: boolean;
  is_recreational: boolean;
  license_number?: string | null;
}

/**
 * Stable per-shop hash (FNV-1a). Used to pick deterministic-but-varied phrasing
 * so the thousands of unclaimed listings don't share near-identical templated
 * copy — same verified facts, different wording, stable across ISR rebuilds.
 */
function shopSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Directory-style About paragraph assembled from verified listing facts, used
 * when the shop hasn't written its own description (the vast majority of
 * unclaimed listings). States only what the record supports — services,
 * license, market, hours cadence — so every sentence stays true per listing.
 * Phrasing is varied deterministically per shop (and keys on the street
 * address when present) so near-identical listings don't read as duplicate copy.
 */
export function generatedAbout(d: ShopFacts, hours: OperatingHours | null): string {
  const stateName = US_STATES[d.state] ?? d.state;
  const seed = shopSeed(`${d.name}|${d.city ?? ''}|${d.state}`);
  const pick = <T>(arr: T[], salt: number): T => arr[(seed >>> salt) % arr.length]!;

  const type = d.is_delivery && !d.is_pickup ? 'delivery service' : 'dispensary';
  const loc = d.city ? `in ${d.city}, ${stateName}` : `operating in ${stateName}`;
  const locCap = d.city ? `In ${d.city}, ${stateName}` : `Operating in ${stateName}`;

  const audience =
    d.is_medical && d.is_recreational
      ? pick(
          [
            'serving both medical patients and recreational customers 21+',
            'open to recreational shoppers 21+ and registered medical patients',
            'welcoming adult-use customers and medical patients alike',
          ],
          2,
        )
      : d.is_medical
        ? pick(
            [
              'serving registered medical patients',
              'a medical-focused shop for registered patients',
              'dedicated to medical cannabis patients',
            ],
            2,
          )
        : d.is_recreational
          ? pick(
              [
                'serving recreational customers 21+',
                'open to adults 21 and over',
                'welcoming recreational shoppers 21+',
              ],
              2,
            )
          : '';

  const area = d.county ? `${d.county} County` : 'the local area';
  const service =
    d.is_pickup && d.is_delivery
      ? pick(
          [
            'offering in-store pickup and local delivery',
            'with both in-store pickup and delivery',
            'for pickup at the shop or delivery to your door',
          ],
          5,
        )
      : d.is_delivery && !d.is_pickup
        ? pick(
            [
              `delivering across ${area}`,
              `bringing orders to ${area}`,
              `covering ${area} by delivery`,
            ],
            5,
          )
        : pick(['for in-store shopping', 'with in-store pickup', 'for walk-in shoppers'], 5);

  const audienceTail = audience ? `, ${audience}` : '';
  // Two grammatically-distinct openers, chosen by seed, so structure varies too.
  const opener =
    seed % 2 === 0
      ? `${d.name} is a licensed cannabis ${type} ${loc}, ${service}${audienceTail}.`
      : `${locCap}, ${d.name} is a licensed cannabis ${type}${audienceTail}, ${service}.`;

  const sentences: string[] = [opener.replace(/\s+/g, ' ')];

  if (d.address) {
    sentences.push(
      pick(
        [
          `You'll find it at ${d.address}.`,
          `The shop is located at ${d.address}.`,
          `Visit in person at ${d.address}.`,
        ],
        9,
      ),
    );
  }

  const openDays = hours ? DAY_ORDER.filter((day) => hours[day]) : [];
  if (openDays.length === 7) {
    sentences.push(
      pick(['It’s open seven days a week.', 'The shop opens daily, seven days a week.'], 12),
    );
  } else if (openDays.length >= 1) {
    sentences.push(
      `The shop is open ${openDays.length} ${openDays.length === 1 ? 'day' : 'days'} a week (${dayLabel(openDays[0]!)}–${dayLabel(openDays[openDays.length - 1]!)}).`,
    );
  }

  if (d.license_number) {
    sentences.push(
      pick(
        [
          `It operates under ${stateName} cannabis license #${d.license_number}, verified against the state registry.`,
          `${d.name} holds ${stateName} cannabis license #${d.license_number}, checked against the state’s public registry.`,
        ],
        16,
      ),
    );
  }

  sentences.push(
    pick(
      [
        'Check the listing above for current hours, services, and directions.',
        'See the details above for hours, contact info, and directions.',
        'Use the map above for directions, and the listing for current hours and services.',
      ],
      20,
    ),
  );

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
    question: `How do I shop at ${d.name}?`,
    answer: opts.hasMenu
      ? `Browse ${d.name}'s menu above to see current products, prices, and deals, then visit the shop to buy in person. Bring a valid 21+ ID — you pay the dispensary directly.`
      : `${d.name} hasn't published its menu on Weedtip yet. You can still see its address, hours, and contact details above, and check back soon for products and deals.`,
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
