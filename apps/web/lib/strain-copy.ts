import type { FaqItem } from '@/components/seo/faq-section';

/**
 * Templated, per-strain prose + FAQ for the strain page. Most strains have no
 * editorial `description`, which left the pages ~130–180 words (Semrush "low
 * word count" / "low text-to-HTML ratio" on ~9k pages). These build unique,
 * honest copy from the structured fields (type, effects, flavors, THC) so every
 * strain page carries real, non-duplicate text paired with its FAQ schema.
 */
export type StrainCopyInput = {
  name: string;
  /** Display label — "Sativa", "Indica", or "Hybrid". */
  typeLabel: string;
  effects: string[];
  flavors: string[];
  thcLow: number | null;
  thcHigh: number | null;
};

const list = (items: string[], max = 3): string => {
  const picked = items.filter(Boolean).slice(0, max);
  if (picked.length === 0) return '';
  if (picked.length === 1) return picked[0] ?? '';
  if (picked.length === 2) return `${picked[0]} and ${picked[1]}`;
  return `${picked.slice(0, -1).join(', ')}, and ${picked[picked.length - 1]}`;
};

function thcPhrase(low: number | null, high: number | null): string | null {
  if (low != null && high != null) return `${low}–${high}% THC`;
  if (low != null || high != null) return `around ${low ?? high}% THC`;
  return null;
}

/** 2–4 sentence intro, unique per strain from its structured attributes. */
export function strainIntro(s: StrainCopyInput): string {
  const type = s.typeLabel.toLowerCase();
  const thc = thcPhrase(s.thcLow, s.thcHigh);
  const sentences: string[] = [
    `${s.name} is a ${type} cannabis strain${thc ? `, typically testing at ${thc}` : ''}.`,
  ];
  const effects = list(s.effects);
  if (effects) sentences.push(`Consumers most often describe its effects as ${effects}.`);
  const flavors = list(s.flavors, 2);
  if (flavors) sentences.push(`On the palate it tends toward ${flavors} notes.`);
  sentences.push(
    `See which licensed dispensaries carry ${s.name} near you below, along with its lineage and similar strains.`,
  );
  return sentences.join(' ');
}

/** Strain-specific FAQ (visible copy + FAQPage schema via FaqSection). */
export function strainFaqs(s: StrainCopyInput): FaqItem[] {
  const type = s.typeLabel.toLowerCase();
  const thc = thcPhrase(s.thcLow, s.thcHigh);
  const effects = list(s.effects);
  const faqs: FaqItem[] = [
    {
      question: `Is ${s.name} an indica or sativa?`,
      answer:
        s.typeLabel === 'Hybrid'
          ? `${s.name} is a hybrid strain, blending indica and sativa characteristics.`
          : `${s.name} is classified as a ${type} strain.`,
    },
    {
      question: `What effects does ${s.name} have?`,
      answer: effects
        ? `${s.name} is most often associated with ${effects} effects, though experiences vary by person, dose, and product.`
        : `Effects vary by person, dose, and the specific product. Check each dispensary's product details and lab results for its cannabinoid and terpene profile.`,
    },
    {
      question: `How much THC is in ${s.name}?`,
      answer: thc
        ? `${s.name} typically tests at ${thc}, but potency varies by grower and batch — always check the lab label on the product you buy.`
        : `THC content varies by grower and batch. Check the lab label on each product for its tested potency.`,
    },
    {
      question: `Where can I buy ${s.name}?`,
      answer: `Browse licensed dispensaries that carry ${s.name} on Weedtip. See the "Where to buy" section above for shops and current prices near you.`,
    },
  ];
  return faqs;
}
