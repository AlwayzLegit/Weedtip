import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ARTICLES } from '@/lib/learn';
import { pageSeo } from '@/lib/seo';

export const metadata: Metadata = pageSeo({
  title: 'Learn',
  description:
    'Cannabis guides for beginners and connoisseurs — how to order online, indica vs sativa, THC and CBD explained, and more from Weedtip.',
  path: '/learn',
});

export default function LearnIndexPage() {
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

      <div className="mt-8 space-y-4">
        {ARTICLES.map((a) => (
          <Link
            key={a.slug}
            href={`/learn/${a.slug}`}
            className="rounded-card border-border bg-surface hover:border-primary/50 group block border p-5 transition-colors"
          >
            <h2 className="group-hover:text-primary text-lg font-semibold">{a.title}</h2>
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
