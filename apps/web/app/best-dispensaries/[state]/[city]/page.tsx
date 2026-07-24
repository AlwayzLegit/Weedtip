import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { Award, Truck } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { RankedShopList } from '@/components/best-of/ranked-shop-list';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { loadBestOf } from '@/lib/best-of';
import { displayRating, sourceMixPhrase } from '@/lib/google-rating';
import { breadcrumbJsonLd, pageSeo, rankedItemListJsonLd } from '@/lib/seo';

// Public, anon-only page — cached HTML, refreshed hourly (ISR).
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const found = await loadBestOf(state, city, false);
  if (!found) return { title: 'Best dispensaries' };
  const st = state.toUpperCase();
  const title = `The ${found.ranked.length} best dispensaries in ${found.cityName}, ${st}`;
  const description = `The top-rated cannabis dispensaries in ${found.cityName}, ${found.stateName}, ranked by ${sourceMixPhrase(found.sources)} — see who leads ${found.cityName} and why, on Weedtip.`;
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
  const found = await loadBestOf(state, city, false);
  if (!found) notFound();
  // Sibling ranking exists only where the delivery field is deep enough.
  const delivery = await loadBestOf(state, city, true);
  const { stateName, cityName, ranked, mean, ratedCount, sources, totalInScope } = found;
  const st = state.toUpperCase();
  const stateLower = state.toLowerCase();
  const cityLower = city.toLowerCase();
  const year = new Date().getFullYear();
  const top = ranked[0]!;
  // Every ranked shop has a displayable rating by construction (loadBestOf filters on it).
  const topRating = displayRating(top)!;
  const mix = sourceMixPhrase(sources);

  const faqs = [
    {
      question: `What is the best dispensary in ${cityName}?`,
      answer: `${top.name} is the top-ranked cannabis dispensary in ${cityName}, ${stateName} — ${topRating.rating.toFixed(1)} stars across ${topRating.count} ${topRating.count === 1 ? 'rating' : 'ratings'} on ${topRating.source === 'google' ? 'Google' : 'Weedtip'}. See the full ranking above for the runners-up.`,
    },
    {
      question: `How are the best dispensaries in ${cityName} ranked?`,
      answer: `We rank by a confidence-weighted average of ${mix}, so a shop needs both a high score and enough ratings to lead — one or two five-star ratings won't outrank a consistently well-rated store. Where a shop has been reviewed on Weedtip we use those reviews; otherwise we use its Google rating, shown and linked as Google's. Ties break toward rating volume and profile completeness. Weedtip doesn't sell ranking positions.`,
    },
    {
      question: `How many dispensaries are in ${cityName}?`,
      answer: `Weedtip lists ${totalInScope} licensed ${totalInScope === 1 ? 'dispensary' : 'dispensaries'} in ${cityName}, ${stateName}, of which ${ratedCount} have a customer rating. Browse the complete directory for hours, menus, and deals.`,
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
          { name: stateName, path: `/dispensaries/${stateLower}` },
          { name: cityName, path: `/dispensaries/${stateLower}/${cityLower}` },
          { name: 'Best of', path: `/best-dispensaries/${stateLower}/${cityLower}` },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: stateName, href: `/dispensaries/${stateLower}` },
          { name: cityName, href: `/dispensaries/${stateLower}/${cityLower}` },
        ]}
      />

      <div className="border-primary/25 bg-primary-subtle text-primary mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
        <Award className="h-3.5 w-3.5" /> Weedtip rankings · {year}
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        The {ranked.length} best dispensaries in {cityName}, {st}
      </h1>
      <p className="text-muted mt-2 max-w-2xl leading-relaxed">
        The highest-rated licensed cannabis dispensaries in {cityName}, ranked by a
        confidence-weighted average of {ratedCount} {ratedCount === 1 ? 'shop' : 'shops'}&apos;{' '}
        {mix} — so consistency, not a lone five-star, decides the order.{' '}
        <Link
          href={`/dispensaries/${stateLower}/${cityLower}`}
          className="text-primary focus-visible:ring-primary rounded font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
        >
          See all {totalInScope} in {cityName} →
        </Link>
      </p>

      {delivery && (
        <Link
          href={`/best-delivery/${stateLower}/${cityLower}`}
          className="border-border bg-surface hover:border-primary/50 hover:text-primary focus-visible:ring-primary mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <Truck className="h-4 w-4" /> Best cannabis delivery in {cityName} →
        </Link>
      )}

      <RankedShopList shops={ranked} mean={mean} />

      <section className="border-border bg-surface-2/40 rounded-card mt-8 border p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Award className="text-primary h-4 w-4" /> How we rank
        </h2>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Each dispensary&apos;s score is a confidence-weighted (Bayesian) average of its customer
          ratings: a store with hundreds of consistent ratings outranks one with a single perfect
          score, because one rating isn&apos;t proof of being the best in {cityName}. When scores
          tie, we favor the shop with more ratings and a more complete profile.
        </p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Where a shop has reviews written on Weedtip, we rank on those. Where it doesn&apos;t, we
          fall back to its Google rating — labeled &ldquo;on Google&rdquo; and linked to the Google
          listing it came from, never presented as ours. Of the {ranked.length} shops here,{' '}
          {sources.weedtip} {sources.weedtip === 1 ? 'is' : 'are'} scored on Weedtip reviews and{' '}
          {sources.google} on Google.
        </p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Rankings update as new ratings come in, and <strong>positions are never sold</strong> —
          sponsored placements are labeled everywhere they appear.
        </p>
      </section>

      <FaqSection items={faqs} heading={`Best dispensaries in ${cityName} — FAQ`} />
    </main>
  );
}
