import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ARTICLES, type LearnTopic } from '@/lib/learn';
import { cn } from '@/lib/utils';
import { pageSeo } from '@/lib/seo';

const TOPICS: LearnTopic[] = ['Ordering', 'Plant', 'Body', 'Products', 'Laws', 'Dictionary'];

export const metadata: Metadata = pageSeo({
  title: 'Learn',
  description:
    'Cannabis guides for beginners and connoisseurs — how to order online, indica vs sativa, THC and CBD explained, and more from Weedtip.',
  path: '/learn',
});

export default async function LearnIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; q?: string }>;
}) {
  const { topic, q } = await searchParams;
  const activeTopic = TOPICS.find((t) => t === topic) ?? null;
  const query = (q ?? '').trim().toLowerCase();
  const articles = ARTICLES.filter(
    (a) =>
      (!activeTopic || a.topic === activeTopic) &&
      (!query ||
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query)),
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Learn', href: '/learn' },
        ]}
      />
      <div className="flex items-center gap-2">
        <BookOpen className="text-primary h-6 w-6" />
        <h1 className="text-3xl font-bold tracking-tight">Learn</h1>
      </div>
      <p className="text-muted mt-2">
        Plain-English cannabis guides — how to order, what the labels mean, and what to expect.
      </p>

      {/* Search + topic tiles (Weedmaps Learn-hub pattern) */}
      <form method="get" action="/learn" className="relative mt-6 max-w-md">
        <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search guides…"
          aria-label="Search guides"
          className="border-border bg-surface focus:border-primary h-10 w-full rounded-full border pl-9 pr-3 text-sm outline-none transition-colors"
        />
        {activeTopic && <input type="hidden" name="topic" value={activeTopic} />}
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/learn"
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            !activeTopic
              ? 'border-primary bg-primary-muted text-primary'
              : 'border-border text-muted hover:text-foreground',
          )}
        >
          All topics
        </Link>
        {TOPICS.map((t) => {
          const count = ARTICLES.filter((a) => a.topic === t).length;
          if (count === 0) return null;
          return (
            <Link
              key={t}
              href={`/learn?topic=${t}`}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                activeTopic === t
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border text-muted hover:text-foreground',
              )}
            >
              {t} ({count})
            </Link>
          );
        })}
      </div>

      {articles.length === 0 && (
        <p className="text-muted mt-8">
          No guides match{query ? ` “${q}”` : ''}.{' '}
          <Link href="/learn" className="text-primary hover:underline">
            Clear filters
          </Link>
        </p>
      )}

      <div className="mt-8 space-y-4">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/learn/${a.slug}`}
            className="rounded-card border-border bg-surface hover:border-primary/50 group block border p-5 transition-colors"
          >
            <p className="text-primary text-xs font-semibold uppercase tracking-wide">
              {a.topic} · {a.readMinutes} min read
            </p>
            <h2 className="group-hover:text-primary mt-1 text-lg font-semibold">{a.title}</h2>
            <p className="text-muted mt-1 text-sm">{a.description}</p>
            <p className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium">
              Read article <ArrowRight className="h-4 w-4" />
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
