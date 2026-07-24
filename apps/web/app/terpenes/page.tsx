import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { Sparkles } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { TERPENES } from '@/lib/terpenes';
import { pageSeo } from '@/lib/seo';

export const revalidate = 86400;

export const metadata: Metadata = pageSeo({
  title: 'Cannabis terpenes guide',
  description:
    'What cannabis terpenes are and what they smell and feel like — myrcene, limonene, caryophyllene, pinene and more, each with the strains that feature it, on Weedtip.',
  path: '/terpenes',
});

export default function TerpenesIndexPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Strains', href: '/strains' },
          { name: 'Terpenes', href: '/terpenes' },
        ]}
      />
      <p className="eyebrow mb-1 mt-2">Learn</p>
      <h1 className="text-2xl font-bold sm:text-3xl">Cannabis terpenes</h1>
      <p className="text-muted mt-2 max-w-2xl leading-relaxed">
        Terpenes are the aromatic compounds that give each strain its smell — citrus, pine, pepper,
        lavender — and shape how it feels. Explore the major cannabis terpenes below, then see which
        strains lead with each.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TERPENES.map((t) => (
          <Link
            key={t.slug}
            href={`/terpene/${t.slug}`}
            className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover focus-visible:ring-primary group border p-5 transition-all focus-visible:outline-none focus-visible:ring-2"
          >
            <h2 className="group-hover:text-primary text-lg font-semibold transition-colors">
              {t.name}
            </h2>
            <p className="text-muted mt-1 text-sm">{t.aroma}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.effects.slice(0, 3).map((e) => (
                <span
                  key={e}
                  className="border-primary/30 bg-primary-muted text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                >
                  <Sparkles className="h-3 w-3" /> {e}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Keep learning</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { href: '/learn/what-are-terpenes', label: 'What are terpenes?' },
            { href: '/learn/indica-vs-sativa-vs-hybrid', label: 'Indica vs sativa vs hybrid' },
            { href: '/strains', label: 'Browse all strains' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="border-border bg-surface hover:border-primary/50 hover:text-primary focus-visible:ring-primary inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
