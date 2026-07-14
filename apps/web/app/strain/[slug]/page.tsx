import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { Leaf, Sprout } from 'lucide-react';
import { ViewTracker } from '@/components/analytics/view-tracker';
import { RecordRecentlyViewed } from '@/components/recently-viewed';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProductCard } from '@/components/product-card';
import { StrainCard } from '@/components/strain-card';
import { StrainFavoriteButton } from '@/components/strain/strain-favorite-button';
import { Badge } from '@/components/ui/badge';
import { CATALOG_IMAGE_EMBED, cardImageUrl } from '@/lib/catalog';
import { JsonLd } from '@/components/seo/json-ld';
import { pageSeo, strainJsonLd } from '@/lib/seo';
import { strainArtUrl } from '@/lib/strain-art';
import { createStaticClient } from '@/lib/supabase/static';

// Public, anon-only page — serve cached HTML and refresh every 60 min (ISR).
export const revalidate = 3600;

const TYPE_LABEL: Record<string, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createStaticClient();
  const { data } = await supabase
    .from('strains')
    .select('name,type,description')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return { title: 'Strain' };
  const title = `${data.name} — ${TYPE_LABEL[data.type]} strain`;
  const description =
    data.description?.slice(0, 160) ??
    `${data.name} is a ${TYPE_LABEL[data.type]} cannabis strain. Explore its effects, flavors, THC range, and which dispensaries carry it on Weedtip.`;
  return pageSeo({ title, description, path: `/strain/${slug}` });
}

export default async function StrainPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createStaticClient();

  const { data: strain } = await supabase
    .from('strains')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!strain) notFound();

  // Products carrying this strain at active dispensaries ("where to buy").
  const { data: products } = await supabase
    .from('products')
    .select(`*, dispensary:dispensaries!inner(slug,name,status), ${CATALOG_IMAGE_EMBED}`)
    .eq('strain_id', strain.id)
    .eq('dispensary.status', 'active')
    .order('price_cents');

  // Lineage links resolve to real strain pages where the parent is in the
  // library (most classics are), falling back to search for the rest.
  const parentNames: string[] = strain.parents ?? [];
  const { data: parentRows } = parentNames.length
    ? await supabase.from('strains').select('name,slug').in('name', parentNames)
    : { data: [] };
  const parentSlug = new Map((parentRows ?? []).map((p) => [p.name, p.slug]));

  // Related strains: same family first, most-saved first (Weedmaps pattern).
  const { data: related } = await supabase
    .from('strains')
    .select('slug,name,type,effects,thc_low,thc_high')
    .eq('type', strain.type)
    .neq('id', strain.id)
    .order('saves_count', { ascending: false })
    .order('name')
    .limit(8);

  const saleMap = new Map<string, number>();
  if (products && products.length) {
    const { data: sales } = await supabase.rpc('sale_prices_for', {
      p_product_ids: products.map((p) => p.id),
    });
    for (const s of sales ?? []) saleMap.set(s.product_id, s.sale_cents);
  }

  // Is the current user signed in / has they saved this strain?
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let saved = false;
  if (user) {
    const { data: fav } = await supabase
      .from('strain_favorites')
      .select('strain_id')
      .eq('strain_id', strain.id)
      .eq('user_id', user.id)
      .maybeSingle();
    saved = !!fav;
  }

  // Calming ↔ energizing lean, derived from the strain family (Leafly-style meter).
  const energizing = strain.type === 'sativa' ? 78 : strain.type === 'indica' ? 22 : 50;
  const hasGrow =
    strain.grow_difficulty ||
    strain.flowering_days_min ||
    strain.flowering_days_max ||
    strain.yield_note ||
    strain.grow_notes;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={strainJsonLd({
          slug: strain.slug,
          name: strain.name,
          type: TYPE_LABEL[strain.type] ?? strain.type,
          description: strain.description,
          thcLow: strain.thc_low,
          thcHigh: strain.thc_high,
          image: strainArtUrl(strain.slug, strain.type),
        })}
      />
      <ViewTracker
        event="strain_viewed"
        properties={{ strain_id: strain.id, slug: strain.slug, name: strain.name, type: strain.type }}
      />
      <RecordRecentlyViewed
        item={{
          kind: 'strain',
          href: `/strain/${strain.slug}`,
          name: strain.name,
          sub: TYPE_LABEL[strain.type],
        }}
      />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Strains', href: '/strains' },
          { name: strain.name, href: `/strain/${strain.slug}` },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Leaf className="text-primary h-6 w-6" />
        <h1 className="text-3xl font-bold">{strain.name}</h1>
        <Badge tone="primary">{TYPE_LABEL[strain.type]}</Badge>
        <div className="ml-auto">
          <StrainFavoriteButton
            strainId={strain.id}
            slug={strain.slug}
            initialSaved={saved}
            initialCount={strain.saves_count}
            isAuthed={!!user}
          />
        </div>
      </div>

      {(strain.thc_low != null || strain.cbd_low != null) && (
        <p className="text-muted mt-2 flex flex-wrap gap-x-4">
          {strain.thc_low != null && strain.thc_high != null && (
            <span>
              THC {strain.thc_low}–{strain.thc_high}%
            </span>
          )}
          {strain.cbd_low != null && strain.cbd_high != null && (
            <span>
              CBD {strain.cbd_low}–{strain.cbd_high}%
            </span>
          )}
        </p>
      )}

      <div className="mt-4 max-w-md">
        <div className="text-muted flex justify-between text-xs">
          <span>Calming</span>
          <span>Energizing</span>
        </div>
        <div className="bg-surface-2 relative mt-1 h-2 rounded-full">
          <span
            className="bg-primary absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
            style={{ left: `${energizing}%` }}
          />
        </div>
      </div>

      {strain.description && <p className="text-muted mt-4 max-w-2xl">{strain.description}</p>}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {strain.effects.length > 0 && (
          <section>
            <h2 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
              Effects
            </h2>
            <div className="flex flex-wrap gap-2">
              {strain.effects.map((e) => (
                <Badge key={e} tone="primary">
                  {e}
                </Badge>
              ))}
            </div>
          </section>
        )}
        {strain.flavors.length > 0 && (
          <section>
            <h2 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
              Flavors
            </h2>
            <div className="flex flex-wrap gap-2">
              {strain.flavors.map((f) => (
                <Badge key={f} tone="outline">
                  {f}
                </Badge>
              ))}
            </div>
          </section>
        )}
        {strain.terpenes.length > 0 && (
          <section>
            <h2 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
              Terpenes
            </h2>
            <div className="flex flex-wrap gap-2">
              {strain.terpenes.map((t) => (
                <Badge key={t} tone="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </section>
        )}
        {strain.negative_effects.length > 0 && (
          <section>
            <h2 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
              May cause
            </h2>
            <div className="flex flex-wrap gap-2">
              {strain.negative_effects.map((e) => (
                <Badge key={e} tone="muted">
                  {e}
                </Badge>
              ))}
            </div>
          </section>
        )}
        {strain.medical_uses.length > 0 && (
          <section>
            <h2 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
              May help with
            </h2>
            <div className="flex flex-wrap gap-2">
              {strain.medical_uses.map((m) => (
                <Badge key={m} tone="primary">
                  {m}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>

      {strain.parents.length > 0 && (
        <section className="mt-8">
          <h2 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
            Genetics
          </h2>
          <p className="text-sm">
            A cross of{' '}
            {strain.parents.map((p, i) => (
              <span key={p}>
                {i > 0 && ' × '}
                <Link
                  href={
                    parentSlug.has(p)
                      ? `/strain/${parentSlug.get(p)}`
                      : `/search?q=${encodeURIComponent(p)}`
                  }
                  className="text-primary hover:underline"
                >
                  {p}
                </Link>
              </span>
            ))}
            .
          </p>
        </section>
      )}

      {hasGrow && (
        <section className="card mt-8 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Sprout className="text-primary h-5 w-5" /> Grow info
          </h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {strain.grow_difficulty && (
              <div>
                <dt className="text-muted text-xs uppercase tracking-wide">Difficulty</dt>
                <dd className="font-medium">{strain.grow_difficulty}</dd>
              </div>
            )}
            {(strain.flowering_days_min || strain.flowering_days_max) && (
              <div>
                <dt className="text-muted text-xs uppercase tracking-wide">Flowering</dt>
                <dd className="font-medium">
                  {strain.flowering_days_min && strain.flowering_days_max
                    ? `${strain.flowering_days_min}–${strain.flowering_days_max} days`
                    : `${strain.flowering_days_min ?? strain.flowering_days_max} days`}
                </dd>
              </div>
            )}
            {strain.yield_note && (
              <div>
                <dt className="text-muted text-xs uppercase tracking-wide">Yield</dt>
                <dd className="font-medium">{strain.yield_note}</dd>
              </div>
            )}
          </dl>
          {strain.grow_notes && <p className="text-muted mt-3 text-sm">{strain.grow_notes}</p>}
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Where to buy</h2>
        {!products || products.length === 0 ? (
          <div className="rounded-card border-border bg-surface flex flex-wrap items-center justify-between gap-3 border p-5">
            <p className="text-muted text-sm">
              No menus currently list {strain.name} by name — check{' '}
              {TYPE_LABEL[strain.type]?.toLowerCase()} products near you or ask your local shop.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/products?strain_type=${strain.type}`}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              >
                Shop {TYPE_LABEL[strain.type]} products
              </Link>
              <Link
                href="/dispensaries"
                className="border-border bg-surface hover:border-primary/50 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              >
                Find shops near you
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const dispensary = p.dispensary as { slug: string; name: string } | null;
              return (
                <ProductCard
                  key={p.id}
                  p={{
                    name: p.name,
                    brand: p.brand ?? dispensary?.name ?? null,
                    priceCents: saleMap.get(p.id) ?? p.price_cents,
                    originalPriceCents: saleMap.has(p.id) ? p.price_cents : null,
                    imageUrl: cardImageUrl(p),
                    strainType: p.strain_type,
                    thcPercentage: p.thc_percentage,
                    inStock: p.in_stock,
                    productId: p.id,
                    dispensarySlug: dispensary?.slug,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {related && related.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              More {TYPE_LABEL[strain.type]?.toLowerCase()} strains
            </h2>
            <Link
              href={`/strains?type=${strain.type}`}
              className="text-primary shrink-0 text-sm font-medium hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((s) => (
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
        </section>
      )}

      {/* Strain pages ↔ Learn hub interlinking (helps both rank). */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Keep learning</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { href: '/learn/indica-vs-sativa-vs-hybrid', label: 'Indica vs sativa vs hybrid' },
            { href: '/learn/what-are-terpenes', label: 'What are terpenes?' },
            { href: '/learn/understanding-thc-and-cbd', label: 'Understanding THC & CBD' },
            { href: '/learn/edible-dosing-guide', label: 'Edible dosing guide' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
