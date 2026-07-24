import type { Metadata } from 'next';
import { cache } from 'react';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { Award, BadgeCheck, MapPin, Store, Truck } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { MediaImage } from '@/components/media-image';
import { OpenNowChip } from '@/components/open-now-chip';
import { RatingStars } from '@/components/rating-stars';
import { Badge } from '@/components/ui/badge';
import { bayesianScore, marketMean, rankDispensaries } from '@/lib/ranking';
import { breadcrumbJsonLd, citySlug, pageSeo, rankedItemListJsonLd, US_STATES } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';
import { fetchAll } from '@/lib/supabase/fetch-all';

// Public, anon-only page — cached HTML, refreshed hourly (ISR).
export const revalidate = 3600;

/** A market needs at least this many rated shops for a credible "best" ranking. */
const MIN_RATED = 3;

/** How many shops the ranked list shows. */
const TOP_N = 10;

type Shop = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string;
  cover_image_url: string | null;
  logo_url: string | null;
  is_delivery: boolean;
  is_pickup: boolean;
  is_medical: boolean;
  is_recreational: boolean;
  featured: boolean;
  rating_avg: number;
  rating_count: number;
  hours: unknown;
  timezone: string | null;
  license_number: string | null;
};

const SELECT =
  'id,slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone,license_number';

// Cached per request so generateMetadata + the page share one query.
const loadBestOf = cache(async function loadBestOf(state: string, city: string) {
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) return null;
  const supabase = createStaticClient();
  const rows = await fetchAll<Shop>((from, to) =>
    supabase
      .from('dispensaries')
      .select(SELECT)
      .eq('status', 'active')
      .eq('state', code)
      .order('name')
      .range(from, to),
  );
  const inCity = rows.filter((s) => citySlug(s.city ?? '') === city.toLowerCase());
  const first = inCity[0];
  if (!first) return null;

  // Only rated shops can be credibly "the best" — an unranked/unreviewed shop
  // isn't evidence of quality. Gate the page on a real field of contenders.
  const rated = inCity.filter((s) => s.rating_count > 0);
  if (rated.length < MIN_RATED) return null;

  const mean = marketMean(rated);
  const ranked = rankDispensaries(rated).slice(0, TOP_N);
  const totalInCity = inCity.length;

  return {
    stateName,
    cityName: first.city ?? '',
    ranked,
    mean,
    ratedCount: rated.length,
    totalInCity,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const found = await loadBestOf(state, city);
  if (!found) return { title: 'Best dispensaries' };
  const st = state.toUpperCase();
  const title = `The ${found.ranked.length} best dispensaries in ${found.cityName}, ${st}`;
  const description = `The top-rated cannabis dispensaries in ${found.cityName}, ${found.stateName}, ranked by verified customer reviews — see who leads ${found.cityName} and why, on Weedtip.`;
  return pageSeo({
    title,
    description,
    path: `/best-dispensaries/${state.toLowerCase()}/${city.toLowerCase()}`,
  });
}

export default async function BestDispensariesPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;
  const found = await loadBestOf(state, city);
  if (!found) notFound();
  const { stateName, cityName, ranked, mean, ratedCount, totalInCity } = found;
  const st = state.toUpperCase();
  const year = new Date().getFullYear();
  const top = ranked[0]!;

  const faqs = [
    {
      question: `What is the best dispensary in ${cityName}?`,
      answer: `Ranked by verified customer reviews, ${top.name} is the top-rated cannabis dispensary in ${cityName}, ${stateName} — ${top.rating_avg.toFixed(1)} stars across ${top.rating_count} ${top.rating_count === 1 ? 'review' : 'reviews'}. See the full ranking above for the runners-up.`,
    },
    {
      question: `How are the best dispensaries in ${cityName} ranked?`,
      answer: `We rank by a confidence-weighted average of each dispensary's customer ratings, so a shop needs both a high score and enough reviews to lead — one or two five-star reviews won't outrank a consistently well-reviewed store. Ties break toward review volume and profile completeness. Weedtip doesn't sell ranking positions.`,
    },
    {
      question: `How many dispensaries are in ${cityName}?`,
      answer: `Weedtip lists ${totalInCity} licensed ${totalInCity === 1 ? 'dispensary' : 'dispensaries'} in ${cityName}, ${stateName}, of which ${ratedCount} have customer reviews. Browse the complete directory for hours, menus, and deals.`,
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={rankedItemListJsonLd(
          ranked.map((s) => ({ name: s.name, path: `/dispensary/${s.slug}` })),
          `Best dispensaries in ${cityName}, ${st}`,
        )}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Dispensaries', path: '/dispensaries' },
          { name: stateName, path: `/dispensaries/${state.toLowerCase()}` },
          { name: cityName, path: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}` },
          {
            name: 'Best of',
            path: `/best-dispensaries/${state.toLowerCase()}/${city.toLowerCase()}`,
          },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: stateName, href: `/dispensaries/${state.toLowerCase()}` },
          { name: cityName, href: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}` },
        ]}
      />

      <div className="border-primary/25 bg-primary-subtle text-primary mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
        <Award className="h-3.5 w-3.5" /> Weedtip rankings · {year}
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        The {ranked.length} best dispensaries in {cityName}, {st}
      </h1>
      <p className="text-muted mt-2 max-w-2xl leading-relaxed">
        The highest-rated licensed cannabis dispensaries in {cityName}, ranked by a
        confidence-weighted average of {ratedCount} {ratedCount === 1 ? 'shop' : 'shops'}&apos;
        verified customer reviews — so consistency, not a lone five-star, decides the order.{' '}
        <Link
          href={`/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}`}
          className="text-primary focus-visible:ring-primary rounded font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
        >
          See all {totalInCity} in {cityName} →
        </Link>
      </p>

      <ol className="mt-8 space-y-4">
        {ranked.map((s, i) => {
          const score = bayesianScore(s.rating_avg, s.rating_count, mean);
          return (
            <li key={s.id}>
              <Link
                href={`/dispensary/${s.slug}`}
                className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover focus-visible:ring-primary group flex gap-4 border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 sm:p-5"
              >
                <div className="flex flex-col items-center gap-1 pt-1">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                      i === 0
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-2 text-muted border-border border'
                    }`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                </div>
                <MediaImage
                  url={s.cover_image_url ?? s.logo_url}
                  alt={s.name}
                  artSeed={s.slug}
                  className="hidden h-20 w-28 shrink-0 rounded-lg sm:block"
                  iconClassName="h-7 w-7"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="group-hover:text-primary text-lg font-semibold transition-colors">
                      <span className="sr-only">{`#${i + 1}: `}</span>
                      {s.name}
                    </h2>
                    {i === 0 && (
                      <Badge tone="primary" className="shrink-0">
                        Top rated
                      </Badge>
                    )}
                    {s.license_number && (
                      <span className="text-muted inline-flex items-center gap-1 text-xs">
                        <BadgeCheck className="text-primary h-3.5 w-3.5" /> Licensed
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <RatingStars rating={s.rating_avg} />
                    <span className="font-semibold">{s.rating_avg.toFixed(1)}</span>
                    <span className="text-muted">
                      ({s.rating_count} {s.rating_count === 1 ? 'review' : 'reviews'})
                    </span>
                    <OpenNowChip hours={s.hours as OperatingHours | null} timezone={s.timezone} />
                  </div>
                  <div className="text-muted mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {s.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {s.city}, {s.state}
                      </span>
                    )}
                    {s.is_pickup && (
                      <span className="inline-flex items-center gap-1">
                        <Store className="h-3 w-3" /> Pickup
                      </span>
                    )}
                    {s.is_delivery && (
                      <span className="inline-flex items-center gap-1">
                        <Truck className="h-3 w-3" /> Delivery
                      </span>
                    )}
                    <span className="ml-auto tabular-nums">Score {score.toFixed(2)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <section className="border-border bg-surface-2/40 rounded-card mt-8 border p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Award className="text-primary h-4 w-4" /> How we rank
        </h2>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Each dispensary&apos;s score is a confidence-weighted (Bayesian) average of its verified
          customer ratings: a store with hundreds of consistent reviews outranks one with a single
          perfect score, because one review isn&apos;t proof of being the best in {cityName}. When
          scores tie, we favor the shop with more reviews and a more complete profile. Rankings
          update as new reviews come in, and <strong>positions are never sold</strong> — sponsored
          placements are labeled everywhere they appear.
        </p>
      </section>

      <FaqSection items={faqs} heading={`Best dispensaries in ${cityName} — FAQ`} />
    </main>
  );
}
