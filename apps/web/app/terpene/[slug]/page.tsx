import type { Metadata } from 'next';
import { cache } from 'react';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { Sparkles, Thermometer } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import type { StrainType } from '@weedtip/shared';
import { StrainCard } from '@/components/strain-card';
import { terpeneBySlug, TERPENES } from '@/lib/terpenes';
import { breadcrumbJsonLd, pageSeo } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';

export const revalidate = 86400;

type StrainRow = {
  slug: string;
  name: string;
  type: StrainType;
  effects: string[];
  thc_low: number | null;
  thc_high: number | null;
};

// Cached per request so generateMetadata + the page share the strains query.
const loadTerpene = cache(async function loadTerpene(slug: string) {
  const terpene = terpeneBySlug(slug);
  if (!terpene) return null;
  const supabase = createStaticClient();
  const [{ data: strains }, { count }] = await Promise.all([
    supabase
      .from('strains')
      .select('slug,name,type,effects,thc_low,thc_high')
      .contains('terpenes', [terpene.name])
      .order('saves_count', { ascending: false })
      .order('name')
      .limit(12),
    supabase
      .from('strains')
      .select('id', { count: 'exact', head: true })
      .contains('terpenes', [terpene.name]),
  ]);
  return { terpene, strains: (strains as StrainRow[] | null) ?? [], total: count ?? 0 };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await loadTerpene(slug);
  if (!found) return { title: 'Terpene' };
  const { terpene } = found;
  return pageSeo({
    title: `${terpene.name} terpene`,
    description: `${terpene.name}: ${terpene.aroma.toLowerCase()}. What ${terpene.name} smells and feels like, where else it occurs, and the cannabis strains that feature it — on Weedtip.`,
    path: `/terpene/${terpene.slug}`,
  });
}

export default async function TerpenePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await loadTerpene(slug);
  if (!found) notFound();
  const { terpene, strains, total } = found;

  const faqs = [
    {
      question: `What does ${terpene.name} smell like?`,
      answer: `${terpene.name} smells ${terpene.aroma.toLowerCase()}. You'll recognize it from ${terpene.alsoIn.slice(0, 3).join(', ')}.`,
    },
    {
      question: `What are the effects of ${terpene.name}?`,
      answer: `Cannabis high in ${terpene.name} is commonly described as ${terpene.effects.join(', ').toLowerCase()}. Terpenes shape a strain's aroma and character but aren't a medical treatment — effects vary by person and by the full mix of compounds in each strain.`,
    },
    {
      question: `Which strains have the most ${terpene.name}?`,
      answer:
        total > 0
          ? `Weedtip lists ${total} ${total === 1 ? 'strain' : 'strains'} that feature ${terpene.name}${strains[0] ? `, including ${strains[0].name}` : ''}. See the full list above.`
          : `Browse the strain library to find strains that feature ${terpene.name}.`,
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ChemicalSubstance',
          name: terpene.name,
          ...(terpene.aliases.length ? { alternateName: terpene.aliases } : {}),
          description: terpene.summary,
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Strains', path: '/strains' },
          { name: 'Terpenes', path: '/terpenes' },
          { name: terpene.name, path: `/terpene/${terpene.slug}` },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Strains', href: '/strains' },
          { name: 'Terpenes', href: '/terpenes' },
          { name: terpene.name, href: `/terpene/${terpene.slug}` },
        ]}
      />

      <p className="eyebrow mb-1 mt-2">Terpene</p>
      <h1 className="text-3xl font-bold tracking-tight">{terpene.name}</h1>
      <p className="text-muted mt-2 max-w-2xl leading-relaxed">{terpene.summary}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border-border bg-surface border p-4">
          <p className="text-muted text-xs font-semibold uppercase tracking-wide">Aroma</p>
          <p className="mt-1 text-sm">{terpene.aroma}</p>
        </div>
        <div className="rounded-card border-border bg-surface border p-4">
          <p className="text-muted text-xs font-semibold uppercase tracking-wide">Also found in</p>
          <p className="mt-1 text-sm">{terpene.alsoIn.join(', ')}</p>
        </div>
        <div className="rounded-card border-border bg-surface border p-4">
          <p className="text-muted flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
            <Thermometer className="h-3.5 w-3.5" /> Boiling point
          </p>
          <p className="mt-1 text-sm">
            {terpene.boilingPointC}°C{' '}
            <span className="text-muted">
              ({Math.round((terpene.boilingPointC * 9) / 5 + 32)}°F)
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
          Commonly reported
        </p>
        <div className="flex flex-wrap gap-2">
          {terpene.effects.map((e) => (
            <span
              key={e}
              className="border-primary/30 bg-primary-muted text-primary inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
            >
              <Sparkles className="h-3 w-3" /> {e}
            </span>
          ))}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">Strains high in {terpene.name}</h2>
        {total > 0 ? (
          <>
            <p className="text-muted mb-3 text-sm">
              {total} {total === 1 ? 'strain features' : 'strains feature'} {terpene.name}
              {total > strains.length ? ` — the ${strains.length} most-saved are below` : ''}.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {strains.map((s) => (
                <StrainCard
                  key={s.slug}
                  s={{
                    slug: s.slug,
                    name: s.name,
                    type: s.type,
                    effects: s.effects ?? [],
                    thcLow: s.thc_low,
                    thcHigh: s.thc_high,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-card border-border bg-surface text-muted border border-dashed p-6 text-center text-sm">
            <p className="text-foreground font-medium">No strains tagged yet</p>
            <p className="mt-1">
              <Link href="/strains" className="text-primary hover:underline">
                Browse the strain library
              </Link>{' '}
              to explore aromas and effects.
            </p>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Other terpenes</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TERPENES.filter((t) => t.slug !== terpene.slug).map((t) => (
            <Link
              key={t.slug}
              href={`/terpene/${t.slug}`}
              className="border-border bg-surface hover:border-primary/50 hover:text-primary focus-visible:ring-primary inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              {t.name}
            </Link>
          ))}
          <Link
            href="/learn/what-are-terpenes"
            className="border-primary/30 bg-primary-muted text-primary focus-visible:ring-primary inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            What are terpenes? →
          </Link>
        </div>
      </section>

      <FaqSection items={faqs} heading={`${terpene.name} — frequently asked questions`} />
    </main>
  );
}
