import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { ArrowRight, BookOpen, Clock, Search } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { MediaImage } from '@/components/media-image';
import { ARTICLES, articleHeroUrl, type LearnTopic } from '@/lib/learn';
import { cn } from '@/lib/utils';
import { pageSeo } from '@/lib/seo';

const TOPICS: LearnTopic[] = ['Ordering', 'Plant', 'Body', 'Products', 'Laws', 'Dictionary'];

export const metadata: Metadata = pageSeo({
  title: 'Learn about cannabis',
  description:
    'Cannabis guides for beginners and connoisseurs — edible dosing, indica vs sativa, terpenes, concentrates, travel laws, and more from Weedtip.',
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
  // Newest first; the freshest article becomes the featured lead card on the
  // unfiltered view.
  const sorted = [...articles].sort(
    (a, b) => +new Date(b.datePublished) - +new Date(a.datePublished),
  );
  const showFeatured = !activeTopic && !query && sorted.length > 3;
  const [featured, ...rest] = showFeatured ? sorted : [null, ...sorted];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
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
      <p className="text-muted mt-2 max-w-2xl">
        Plain-English cannabis guides — dosing, strain types, product formats, and the rules of the
        road. No jargon, no medical claims, just what you need to shop and consume confidently.
      </p>

      {/* Search + topic chips (Weedmaps Learn-hub pattern) */}
      <form method="get" action="/learn" className="relative mt-6 max-w-md">
        <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search guides…"
          aria-label="Search guides"
          className="border-border bg-surface focus:border-primary h-10 w-full rounded-full border pl-9 pr-3 text-base outline-none transition-colors sm:text-sm"
        />
        {activeTopic && <input type="hidden" name="topic" value={activeTopic} />}
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/learn"
          className={cn(
            'inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors',
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
                'inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors',
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

      {featured && (
        <Link
          href={`/learn/${featured.slug}`}
          className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover group mt-8 block overflow-hidden border transition-all sm:grid sm:grid-cols-5"
        >
          <MediaImage
            url={articleHeroUrl(featured.slug)}
            alt={featured.title}
            artSeed={featured.title}
            artIcon={<BookOpen className="text-foreground/20 h-10 w-10" strokeWidth={1.5} />}
            className="h-40 sm:col-span-2 sm:h-full"
          />
          <div className="p-6 sm:col-span-3">
            <p className="text-primary text-xs font-semibold uppercase tracking-wide">
              Latest · {featured.topic}
            </p>
            <h2 className="group-hover:text-primary mt-2 text-xl font-bold sm:text-2xl">
              {featured.title}
            </h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">{featured.description}</p>
            <p className="text-muted mt-4 flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {featured.readMinutes} min read
              </span>
              <span className="text-primary inline-flex items-center gap-1 font-medium">
                Read article <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </p>
          </div>
        </Link>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {rest
          .filter((a): a is NonNullable<typeof a> => !!a)
          .map((a) => (
            <Link
              key={a.slug}
              href={`/learn/${a.slug}`}
              className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover group flex flex-col overflow-hidden border transition-all"
            >
              <MediaImage
                url={articleHeroUrl(a.slug)}
                alt={a.title}
                artSeed={a.title}
                artIcon={<BookOpen className="text-foreground/20 h-8 w-8" strokeWidth={1.5} />}
                className="h-28"
              />
              <div className="flex flex-1 flex-col p-5">
                <p className="text-primary text-xs font-semibold uppercase tracking-wide">
                  {a.topic}
                </p>
                <h2 className="group-hover:text-primary mt-1 font-semibold leading-snug">
                  {a.title}
                </h2>
                <p className="text-muted mt-1.5 line-clamp-2 text-sm">{a.description}</p>
                <p className="text-muted mt-auto flex items-center gap-1 pt-3 text-xs">
                  <Clock className="h-3.5 w-3.5" /> {a.readMinutes} min read
                </p>
              </div>
            </Link>
          ))}
      </div>
    </main>
  );
}
