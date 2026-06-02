import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { ARTICLES, getArticle } from '@/lib/learn';
import { absoluteUrl, DEFAULT_OG_IMAGE, pageSeo } from '@/lib/seo';
import { SITE_NAME } from '@/lib/site';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: 'Learn' };
  return pageSeo({ title: article.title, description: article.description, path: `/learn/${slug}` });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    mainEntityOfPage: absoluteUrl(`/learn/${slug}`),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.svg') },
    },
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Learn', href: '/learn' },
          { name: article.title, href: `/learn/${slug}` },
        ]}
      />
      <article>
        <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
        <p className="text-muted mt-2 text-sm">
          {new Date(article.datePublished).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}{' '}
          · {article.readMinutes} min read
        </p>

        <div className="mt-8 space-y-6">
          {article.body.map((section, i) => (
            <section key={i}>
              {section.heading && (
                <h2 className="mb-2 text-lg font-semibold">{section.heading}</h2>
              )}
              {section.paragraphs.map((p, j) => (
                <p key={j} className="text-foreground/90 text-sm leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>

      <p className="text-foreground/80 mt-10 rounded-card border-border bg-surface border p-4 text-xs leading-relaxed">
        This article is for general information only and is not medical or legal advice. Cannabis
        products have not been evaluated by the FDA. Must be 21+. Consult a healthcare provider and
        check your local laws.
      </p>

      <Link
        href="/learn"
        className="text-primary mt-8 inline-flex items-center gap-1 text-sm font-medium hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All guides
      </Link>
    </main>
  );
}
