/**
 * Editorial "Learn" content. Evergreen guides rendered at /learn and /learn/[slug]
 * with Article structured data. Kept as data (not a CMS) for simplicity; swap for
 * MDX/a CMS later without changing the routes or schema.
 */
import { MORE_ARTICLES } from './learn-articles-2';
import { MORE_ARTICLES_3 } from './learn-articles-3';

export interface LearnSection {
  heading?: string;
  paragraphs: string[];
}

export type LearnTopic =
  | 'Ordering'
  | 'Plant'
  | 'Body'
  | 'Products'
  | 'Laws'
  | 'Dictionary';

export interface Article {
  slug: string;
  topic: LearnTopic;
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  readMinutes: number;
  body: LearnSection[];
  /** Question/answer pairs rendered on-page and as FAQPage structured data. */
  faq?: { question: string; answer: string }[];
  /** Strain pages worth linking from this article ({ name, slug }). */
  relatedStrains?: { name: string; slug: string }[];
  /** Slugs of related articles (falls back to same-topic when omitted). */
  related?: string[];
}

const CORE_ARTICLES: Article[] = [
  {
    slug: 'how-to-order-cannabis-online',
    topic: 'Ordering',
    title: 'How to order cannabis online for pickup or delivery',
    description:
      'A step-by-step guide to finding a licensed dispensary, building your cart, and ordering cannabis for pickup or delivery.',
    datePublished: '2026-06-02',
    dateModified: '2026-06-02',
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          'Ordering cannabis online is fast and convenient once you know the steps. On Weedtip you can browse licensed dispensaries near you, compare menus and prices, and place an order for in-store pickup or delivery where available. Here is how it works from start to finish.',
        ],
      },
      {
        heading: '1. Find a licensed dispensary near you',
        paragraphs: [
          'Start on the Dispensaries page and search by name or use your location to see nearby shops. You can filter by pickup, delivery, open-now, and product category. Every listing shows hours, ratings, and the services it offers so you can pick the right one.',
        ],
      },
      {
        heading: '2. Browse the menu and build your cart',
        paragraphs: [
          'Open a dispensary to see its full menu grouped by category — flower, vapes, edibles, concentrates, and more. Each product lists price, potency (THC/CBD), brand, and reviews. Add items to your cart and adjust quantities as you go.',
        ],
      },
      {
        heading: '3. Choose pickup or delivery and check out',
        paragraphs: [
          'At checkout, choose pickup or delivery (if the shop offers it). Prices and totals are calculated from the dispensary’s live menu, so what you see is what you pay. You can pay online where available, or pay in person at the dispensary.',
        ],
      },
      {
        heading: '4. Bring a valid 21+ ID',
        paragraphs: [
          'You must be 21 or older (or a qualifying medical patient where permitted) to buy cannabis. Bring a valid government-issued ID to pickup or have it ready for delivery — dispensaries are required to verify your age.',
        ],
      },
    ],
  },
  {
    slug: 'indica-vs-sativa-vs-hybrid',
    topic: 'Plant',
    title: 'Indica vs Sativa vs Hybrid: what’s the difference?',
    description:
      'A plain-English explainer of indica, sativa, and hybrid cannabis — what the labels mean, and why effects vary from person to person.',
    datePublished: '2026-06-02',
    dateModified: '2026-06-02',
    readMinutes: 5,
    body: [
      {
        paragraphs: [
          'Walk into any dispensary and you’ll see products labeled indica, sativa, or hybrid. These labels are a useful starting point, but the real story is more nuanced. Here’s what each term generally means and how to use it.',
        ],
      },
      {
        heading: 'Indica',
        paragraphs: [
          'Indica strains are often associated with relaxing, full-body effects — the kind of thing people reach for in the evening. Many find them calming and good for winding down. Classic examples include Granddaddy Purple and Northern Lights.',
        ],
      },
      {
        heading: 'Sativa',
        paragraphs: [
          'Sativa strains are typically described as more energizing and cerebral, and are popular for daytime use. People often choose them when they want to feel uplifted or creative. Sour Diesel and Jack Herer are well-known sativas.',
        ],
      },
      {
        heading: 'Hybrid',
        paragraphs: [
          'Hybrids blend indica and sativa genetics and make up most of today’s market. They can lean either way or sit in the middle, so the listed strain type and the product’s described effects matter more than the broad category alone.',
        ],
      },
      {
        heading: 'Why effects vary',
        paragraphs: [
          'Your experience depends on more than indica vs sativa — potency (THC/CBD), terpenes, dose, tolerance, and your own body all play a role. Use the labels as a guide, start low and go slow, and read product descriptions and reviews to choose what fits your goals.',
        ],
      },
    ],
  },
  {
    slug: 'understanding-thc-and-cbd',
    topic: 'Body',
    title: 'Understanding THC and CBD',
    description:
      'What THC and CBD are, how they differ, and how to read potency percentages so you can choose products with confidence.',
    datePublished: '2026-06-02',
    dateModified: '2026-06-02',
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          'THC and CBD are the two most talked-about compounds in cannabis. Knowing the basics helps you compare products and pick the right potency for you.',
        ],
      },
      {
        heading: 'THC',
        paragraphs: [
          'THC (tetrahydrocannabinol) is the primary intoxicating compound in cannabis — it’s what produces the “high.” Products list THC as a percentage (for flower) or in milligrams (for edibles). Higher numbers mean stronger effects.',
        ],
      },
      {
        heading: 'CBD',
        paragraphs: [
          'CBD (cannabidiol) is non-intoxicating and is often chosen for a more balanced or clear-headed experience. Some products pair CBD with THC; the ratio between them shapes how a product feels.',
        ],
      },
      {
        heading: 'Reading potency and dosing',
        paragraphs: [
          'For edibles, a common starting dose is 2.5–5 mg of THC; wait at least an hour before taking more. For flower and vapes, potency is shown as a percentage. If you’re new or returning after a break, start low and go slow — you can always take more, but you can’t take less.',
        ],
      },
    ],
  },
  {
    slug: 'what-to-bring-to-a-dispensary',
    topic: 'Ordering',
    title: 'What to bring to a dispensary',
    description:
      'A quick checklist for your first dispensary visit — ID requirements, payment, and what to expect at pickup.',
    datePublished: '2026-06-02',
    dateModified: '2026-06-02',
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          'Heading to a dispensary for the first time? A little prep makes pickup smooth. Here’s what to have ready.',
        ],
      },
      {
        heading: 'A valid government-issued ID',
        paragraphs: [
          'You must be 21 or older (or a qualifying medical patient where permitted). Bring a valid, unexpired government-issued photo ID — dispensaries are legally required to verify your age before you enter or pick up an order.',
        ],
      },
      {
        heading: 'Payment',
        paragraphs: [
          'Payment options vary by shop. Some accept cards or online payment; others are cash-preferred and may have an ATM on site. Check the dispensary’s page or your order confirmation for accepted methods.',
        ],
      },
      {
        heading: 'Your order details',
        paragraphs: [
          'If you ordered ahead on Weedtip, have your order confirmation handy. At pickup, staff will verify your ID, confirm your items, and complete payment. If anything changed, a budtender can help you adjust.',
        ],
      },
    ],
  },
];

export const ARTICLES: Article[] = [...CORE_ARTICLES, ...MORE_ARTICLES, ...MORE_ARTICLES_3];

export function getArticle(slug: string): Article | null {
  return ARTICLES.find((a) => a.slug === slug) ?? null;
}

/** Related reading for an article: explicit list first, same-topic fill. */
export function relatedArticles(article: Article, limit = 3): Article[] {
  const explicit = (article.related ?? [])
    .map((s) => ARTICLES.find((a) => a.slug === s))
    .filter((a): a is Article => !!a);
  const sameTopic = ARTICLES.filter(
    (a) =>
      a.slug !== article.slug && a.topic === article.topic && !explicit.some((e) => e.slug === a.slug),
  );
  return [...explicit, ...sameTopic].slice(0, limit);
}
