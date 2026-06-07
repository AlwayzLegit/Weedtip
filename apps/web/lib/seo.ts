import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site';

/** Absolute URL for a site-relative path. */
export const absoluteUrl = (path: string): string =>
  `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

type Json = Record<string, unknown>;

/** Default social-share image (the site-wide branded OG card). */
export const DEFAULT_OG_IMAGE = '/opengraph-image';

/**
 * Standard per-page metadata: title, description, canonical, and OG/Twitter with
 * the default share image. Use on pages WITHOUT their own opengraph-image file
 * (dispensary/product pages have dedicated cards and shouldn't pass an image here).
 */
export function pageSeo({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', title, description, url: path, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/** FAQPage schema from question/answer pairs. */
export function faqJsonLd(items: { question: string; answer: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}

/** Organization schema for the brand (home page). */
export function organizationJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/icon.svg'),
    description: SITE_DESCRIPTION,
  };
}

/** WebSite schema with a Sitelinks Search Box pointed at dispensary search. */
export function websiteJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/dispensaries?query={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** BreadcrumbList schema from ordered { name, path } crumbs. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** ItemList schema for a results/listing page (ordered URLs). */
export function itemListJsonLd(paths: string[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: paths.length,
    itemListElement: paths.map((path, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(path),
    })),
  };
}

const DAY_OF_WEEK: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Convert an `hours` JSONB blob to schema.org OpeningHoursSpecification entries. */
export function openingHoursSpec(
  hours: Record<string, { open?: string; close?: string } | null> | null | undefined,
): Json[] {
  if (!hours) return [];
  const spec: Json[] = [];
  for (const [key, label] of Object.entries(DAY_OF_WEEK)) {
    const h = hours[key];
    if (h?.open && h?.close) {
      spec.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: label,
        opens: h.open,
        closes: h.close,
      });
    }
  }
  return spec;
}

/** US states + DC, code → full name. Drives location landing pages and labels. */
export const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

/** "Denver" → "denver" slug for city URLs (reversible enough for lookups). */
export const citySlug = (city: string | null | undefined): string =>
  (city ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
