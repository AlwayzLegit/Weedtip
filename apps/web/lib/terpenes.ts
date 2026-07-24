/**
 * Curated profiles for the cannabis terpenes present in the strain library.
 * Editorial, factual content (aroma, commonly-reported effects, where else the
 * compound occurs) — the basis of the /terpenes hub and each /terpene/[slug]
 * page, which pair this with a live reverse-lookup of strains that feature it.
 *
 * Names match the exact strings used in `strains.terpenes`; `aliases` cover the
 * scientific spellings (β-, alpha-) so chip → page matching stays robust.
 */
export type Terpene = {
  slug: string;
  /** Display + DB-matching name (matches values in strains.terpenes). */
  name: string;
  aliases: string[];
  /** One-line aroma signature for cards and titles. */
  aroma: string;
  /** Commonly-reported effects (not medical claims). */
  effects: string[];
  /** Everyday sources people recognize the smell from. */
  alsoIn: string[];
  /** Commonly-cited boiling point (°C) used in vape-temp guides. */
  boilingPointC: number;
  /** 2–3 sentence profile. */
  summary: string;
};

export const TERPENES: Terpene[] = [
  {
    slug: 'myrcene',
    name: 'Myrcene',
    aliases: ['β-Myrcene', 'Beta-Myrcene'],
    aroma: 'Earthy, musky, herbal — with a ripe-fruit sweetness',
    effects: ['Relaxing', 'Calming', 'Body-heavy'],
    alsoIn: ['Mango', 'Hops', 'Lemongrass', 'Thyme'],
    boilingPointC: 167,
    summary:
      'Myrcene is the most abundant terpene in modern cannabis and sets the earthy, slightly sweet base note many strains share. It is widely associated with the relaxed, settled feeling of indica-leaning varieties, and it is the same compound that gives hops and ripe mango their musky aroma.',
  },
  {
    slug: 'caryophyllene',
    name: 'Caryophyllene',
    aliases: ['β-Caryophyllene', 'Beta-Caryophyllene'],
    aroma: 'Peppery, spicy, and warmly woody',
    effects: ['Comforting', 'Stress-easing', 'Grounding'],
    alsoIn: ['Black pepper', 'Cloves', 'Cinnamon', 'Rosemary'],
    boilingPointC: 130,
    summary:
      'Caryophyllene is the terpene behind the peppery bite in many strains — and it is unusual: it is the only common cannabis terpene that interacts with the body’s CB2 receptors, which is why it is so often tied to comfort and stress relief. You already know its smell from cracked black pepper and cloves.',
  },
  {
    slug: 'limonene',
    name: 'Limonene',
    aliases: ['D-Limonene'],
    aroma: 'Bright citrus — lemon and orange peel',
    effects: ['Uplifting', 'Mood-lifting', 'Energizing'],
    alsoIn: ['Citrus rinds', 'Juniper', 'Peppermint'],
    boilingPointC: 176,
    summary:
      'Limonene gives strains their zesty, citrus-peel lift and is one of the most recognizable cannabis aromas. It is commonly reported alongside bright, uplifting, mood-forward experiences, and it is the same oil pressed from lemon and orange rinds.',
  },
  {
    slug: 'pinene',
    name: 'Pinene',
    aliases: ['α-Pinene', 'Alpha-Pinene', 'a-Pinene'],
    aroma: 'Fresh pine forest and rosemary',
    effects: ['Alerting', 'Focus-supporting', 'Clear-headed'],
    alsoIn: ['Pine needles', 'Rosemary', 'Basil', 'Dill'],
    boilingPointC: 155,
    summary:
      'Pinene smells exactly like it sounds — a walk through a pine forest — and is one of the most widespread terpenes in nature. In cannabis it is often linked to a clear-headed, alert quality, a counterpoint to the heavier feel of myrcene-dominant strains.',
  },
  {
    slug: 'humulene',
    name: 'Humulene',
    aliases: ['α-Humulene', 'Alpha-Humulene', 'Alpha-Caryophyllene'],
    aroma: 'Earthy, woody, and hoppy',
    effects: ['Grounding', 'Earthy', 'Mellow'],
    alsoIn: ['Hops', 'Coriander', 'Cloves', 'Sage'],
    boilingPointC: 106,
    summary:
      'Humulene shares a chemical backbone with caryophyllene and the two frequently appear together, giving beer its hoppy bite. In cannabis it contributes an earthy, woody depth and rounds out the aroma of many spice-forward strains.',
  },
  {
    slug: 'linalool',
    name: 'Linalool',
    aliases: [],
    aroma: 'Soft floral lavender with a touch of spice',
    effects: ['Calming', 'Soothing', 'Relaxing'],
    alsoIn: ['Lavender', 'Coriander', 'Birch bark'],
    boilingPointC: 198,
    summary:
      'Linalool is the lavender note — delicate, floral, faintly spicy — and is the terpene most associated with a calm, soothing character. It is far less common than myrcene or caryophyllene, so strains that carry it noticeably tend to stand out.',
  },
  {
    slug: 'terpinolene',
    name: 'Terpinolene',
    aliases: [],
    aroma: 'Complex — piney, floral, herbal, and citrusy at once',
    effects: ['Uplifting', 'Fresh', 'Bright'],
    alsoIn: ['Nutmeg', 'Apple', 'Cumin', 'Lilac'],
    boilingPointC: 186,
    summary:
      'Terpinolene is a chameleon: piney, floral, herbal, and citrusy all at once, which makes it hard to pin down but easy to enjoy. It shows up in many bright, uplifting sativa-leaning strains and is the aromatic thread through nutmeg, apples, and lilac.',
  },
  {
    slug: 'ocimene',
    name: 'Ocimene',
    aliases: [],
    aroma: 'Sweet, herbal, and lightly woody',
    effects: ['Fresh', 'Sweet', 'Uplifting'],
    alsoIn: ['Mint', 'Parsley', 'Basil', 'Orchids'],
    boilingPointC: 100,
    summary:
      'Ocimene brings a sweet, fresh-herb aroma with a hint of wood and is common across fragrant plants like mint and basil. In cannabis it usually plays a supporting role, lifting a strain’s overall bouquet rather than dominating it.',
  },
];

const BY_SLUG = new Map(TERPENES.map((t) => [t.slug, t]));

/** Every name/alias → slug, lowercased, for matching a strain's terpene chip. */
const NAME_TO_SLUG = new Map<string, string>();
for (const t of TERPENES) {
  NAME_TO_SLUG.set(t.name.toLowerCase(), t.slug);
  for (const a of t.aliases) NAME_TO_SLUG.set(a.toLowerCase(), t.slug);
}

export function terpeneBySlug(slug: string): Terpene | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

/** The catalog slug for a raw terpene name from the DB (or null if uncatalogued). */
export function terpeneSlugForName(name: string): string | null {
  return NAME_TO_SLUG.get(name.trim().toLowerCase()) ?? null;
}
