import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpen, ChevronDown, Clock, Leaf, MapPin } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { MediaImage } from '@/components/media-image';
import { JsonLd } from '@/components/seo/json-ld';
import { ARTICLES, articleHeroUrl, getArticle, relatedArticles } from '@/lib/learn';
import { absoluteUrl, DEFAULT_OG_IMAGE, pageSeo } from '@/lib/seo';
import { SITE_NAME } from '@/lib/site';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

/** Stable anchor ids for section headings (TOC + deep links). */
function headingId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: 'Learn' };
  return pageSeo({
    title: article.title,
    description: article.description,
    path: `/learn/${slug}`,
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  // Only articles with a real hero webp reference it; the rest avoid a 404'd
  // image request (and fall back to the seeded gradient art below).
  const hero = articleHeroUrl(slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    image: hero
      ? [absoluteUrl(hero), absoluteUrl(DEFAULT_OG_IMAGE)]
      : [absoluteUrl(DEFAULT_OG_IMAGE)],
    mainEntityOfPage: absoluteUrl(`/learn/${slug}`),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.svg') },
    },
  };
  const faqJsonLd =
    article.faq && article.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: article.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;

  const toc = article.body
    .map((s) => s.heading)
    .filter((h): h is string => !!h)
    .map((h) => ({ heading: h, id: headingId(h) }));
  const related = relatedArticles(article);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Learn', href: '/learn' },
          { name: article.title, href: `/learn/${slug}` },
        ]}
      />
      <article>
        <Link
          href={`/learn?topic=${article.topic}`}
          className="border-primary/30 bg-primary-muted text-primary inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold"
        >
          {article.topic}
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{article.title}</h1>
        <p className="text-muted mt-3 text-base leading-relaxed">{article.description}</p>
        <p className="text-muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>
            Updated{' '}
            {new Date(article.dateModified).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {article.readMinutes} min read
          </span>
        </p>

        {/* Editorial hero: the real webp when the article ships one, else the
            seeded gradient art (never a 404'd image request). */}
        <MediaImage
          url={hero}
          alt={article.title}
          artSeed={article.title}
          artIcon={<BookOpen className="text-foreground/20 h-10 w-10" strokeWidth={1.5} />}
          priority
          className="rounded-card border-border mt-6 aspect-[16/9] w-full border"
        />

        {toc.length > 2 && (
          <nav
            aria-label="On this page"
            className="rounded-card border-border bg-surface mt-6 border p-4"
          >
            <p className="text-foreground text-xs font-semibold uppercase tracking-wide">
              On this page
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="text-muted hover:text-primary transition-colors">
                    {t.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mt-8 space-y-8">
          {article.body.map((section, i) => (
            <section key={i} id={section.heading ? headingId(section.heading) : undefined}>
              {section.heading && (
                <h2 className="mb-2.5 scroll-mt-20 text-xl font-semibold">{section.heading}</h2>
              )}
              <div className="space-y-3">
                {section.paragraphs.map((p, j) => (
                  <p key={j} className="text-foreground/90 text-[15px] leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {article.faq && article.faq.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Frequently asked questions</h2>
            <div className="mt-4 space-y-3">
              {article.faq.map((f) => (
                <details
                  key={f.question}
                  className="rounded-card border-border bg-surface group border p-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                    {f.question}
                    <ChevronDown className="chev text-muted h-4 w-4 shrink-0" />
                  </summary>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </article>

      {article.relatedStrains && article.relatedStrains.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Strains mentioned</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {article.relatedStrains.map((s) => (
              <Link
                key={s.slug}
                href={`/strain/${s.slug}`}
                className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors"
              >
                <Leaf className="h-3.5 w-3.5" /> {s.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Task CTA: every guide should end with a path back into the marketplace. */}
      <div className="rounded-card border-border bg-surface mt-10 flex flex-col items-start gap-3 border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Ready to shop?</p>
          <p className="text-muted mt-0.5 text-sm">
            Compare menus, deals, and reviews at licensed dispensaries near you.
          </p>
        </div>
        <Link
          href="/dispensaries"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
        >
          <MapPin className="h-4 w-4" /> Find dispensaries
        </Link>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold">Keep reading</h2>
            <Link
              href="/learn"
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              All guides <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((a) => (
              <Link
                key={a.slug}
                href={`/learn/${a.slug}`}
                className="rounded-card border-border bg-surface hover:border-primary/50 group block border p-4 transition-colors"
              >
                <p className="text-primary inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                  <BookOpen className="h-3.5 w-3.5" /> {a.topic}
                </p>
                <p className="group-hover:text-primary mt-1.5 text-sm font-semibold leading-snug">
                  {a.title}
                </p>
                <p className="text-muted mt-2 flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" /> {a.readMinutes} min read
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-foreground/80 rounded-card border-border bg-surface mt-10 border p-4 text-xs leading-relaxed">
        This article is for general information only and is not medical or legal advice. Cannabis
        products have not been evaluated by the FDA. Must be 21+. Consult a healthcare provider and
        check your local laws.
      </p>
    </main>
  );
}
