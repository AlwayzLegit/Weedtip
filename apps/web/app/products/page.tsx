import type { Metadata } from 'next';
import { productSearchSchema, type StrainType } from '@weedtip/shared';
import { searchProducts } from '@weedtip/supabase/queries';
import { LineupCard, type LineupItem } from '@/components/brand/lineup-card';
import { ProductCard } from '@/components/product-card';
import { ProductFilters } from '@/components/product-filters';
import { CATALOG_IMAGE_EMBED, cardImageUrl, catalogImageSrc } from '@/lib/catalog';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Products',
  description:
    'Browse cannabis products across dispensaries — flower, vapes, edibles, concentrates and more — with prices, THC/CBD, and reviews on Weedtip.',
  path: '/products',
});

type SearchParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined);
const int = (v: string | string[] | undefined) => {
  const s = str(v);
  return s && Number.isFinite(Number(s)) ? Number(s) : undefined;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const params = productSearchSchema.parse({
    query: str(sp.query),
    category_slug: str(sp.category),
    strain_type: str(sp.strain) as StrainType | undefined,
    max_price_cents: int(sp.max_price),
    in_stock_only: sp.in_stock === 'false' ? false : true,
    page: int(sp.page),
  });
  // The brand catalog paginates independently of the menu grid.
  const catPage = Math.max(1, int(sp.cat_page) ?? 1);
  const CAT_PAGE_SIZE = 24;

  const supabase = await createClient();
  const [{ data: categories }, productsRes] = await Promise.all([
    supabase.from('categories').select('name,slug').order('sort_order'),
    searchProducts(supabase, params),
  ]);

  const rows = [...(productsRes.data ?? [])];

  // Client-side sort over the page of results.
  const sort = typeof sp.sort === 'string' ? sp.sort : '';
  if (sort === 'price_asc') rows.sort((a, b) => a.price_cents - b.price_cents);
  else if (sort === 'price_desc') rows.sort((a, b) => b.price_cents - a.price_cents);
  else if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'rating')
    rows.sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count);

  // Resolve dispensary slugs for product → shop links.
  const dispensaryIds = [...new Set(rows.map((r) => r.dispensary_id))];
  const slugById = new Map<string, string>();
  if (dispensaryIds.length > 0) {
    const { data: shops } = await supabase
      .from('dispensaries')
      .select('id,slug')
      .in('id', dispensaryIds);
    shops?.forEach((s) => slugById.set(s.id, s.slug));
  }

  const total = rows[0]?.total_count ?? 0;

  // Sponsored products: live promoted_product placements, shown on the first
  // page only and de-duped from the organic results.
  type SponsoredProduct = {
    id: string;
    name: string;
    brand: string | null;
    price_cents: number;
    image_urls: string[];
    strain_type: StrainType | null;
    thc_percentage: number | null;
    in_stock: boolean;
    rating_avg: number;
    rating_count: number;
    dispensary: { slug: string; status: string } | null;
    catalog: { id: string; image_url: string | null } | null;
    placementId: string;
  };
  let sponsored: SponsoredProduct[] = [];
  if ((params.page ?? 1) === 1) {
    const nowIso = new Date().toISOString();
    const { data: promos } = await supabase
      .from('placements')
      .select('id, target_id, priority')
      .eq('type', 'promoted_product')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('priority', { ascending: false });
    const promoIds = (promos ?? []).map((p) => p.target_id).filter((id): id is string => !!id);
    if (promoIds.length > 0) {
      const placementOf = new Map(
        (promos ?? []).map((p) => [p.target_id, { id: p.id, priority: p.priority }] as const),
      );
      const { data: prods } = await supabase
        .from('products')
        .select(
          `id,name,brand,price_cents,image_urls,strain_type,thc_percentage,in_stock,rating_avg,rating_count,dispensary:dispensaries!inner(slug,status), ${CATALOG_IMAGE_EMBED}`,
        )
        .in('id', promoIds)
        .eq('dispensary.status', 'active');
      sponsored = ((prods as Omit<SponsoredProduct, 'placementId'>[]) ?? [])
        .map((p) => ({ ...p, placementId: placementOf.get(p.id)?.id ?? '' }))
        .sort(
          (a, b) => (placementOf.get(b.id)?.priority ?? 0) - (placementOf.get(a.id)?.priority ?? 0),
        );
    }
  }
  const sponsoredIds = new Set(sponsored.map((p) => p.id));
  const organic = rows.filter((r) => !sponsoredIds.has(r.id));

  // Catalog image fallback for organic rows (the search RPC has no embed).
  const catalogImageById = new Map<string, string>();
  const organicNoImg = organic
    .filter((r) => !(r.image_urls && r.image_urls.length > 0))
    .map((r) => r.id);
  if (organicNoImg.length > 0) {
    const { data: cat } = await supabase
      .from('products')
      .select(`id, ${CATALOG_IMAGE_EMBED}`)
      .in('id', organicNoImg);
    for (const c of cat ?? []) {
      const cat = c.catalog as { id: string; image_url: string | null } | null;
      const img = cat ? catalogImageSrc(cat.id, cat.image_url) : null;
      if (img) catalogImageById.set(c.id, img);
    }
  }

  // Resolve active storefront sale prices for everything on the page.
  const shownIds = [...new Set([...sponsored.map((p) => p.id), ...organic.map((r) => r.id)])];
  const saleMap = new Map<string, number>();
  if (shownIds.length > 0) {
    const { data: sales } = await supabase.rpc('sale_prices_for', { p_product_ids: shownIds });
    for (const s of sales ?? []) saleMap.set(s.product_id, s.sale_cents);
  }

  // Official brand-catalog section — the full scraped catalog is browsable
  // here with its own pagination; honors the category/strain/query filters.
  let lineup: LineupItem[] = [];
  let lineupTotal = 0;
  {
    let lineupQuery = supabase
      .from('brand_products')
      .select(
        'id,name,strain_type,thc_percentage,description,image_url,category:categories(slug),brand:brands!inner(name,slug,logo_url)',
        { count: 'exact' },
      )
      .order('sort_order')
      .order('name')
      .range((catPage - 1) * CAT_PAGE_SIZE, catPage * CAT_PAGE_SIZE - 1);
    if (params.category_slug) {
      const cat = (categories ?? []).find((c) => c.slug === params.category_slug);
      const { data: catRow } = cat
        ? await supabase.from('categories').select('id').eq('slug', cat.slug).maybeSingle()
        : { data: null };
      if (catRow) lineupQuery = lineupQuery.eq('category_id', catRow.id);
    }
    if (params.strain_type) lineupQuery = lineupQuery.eq('strain_type', params.strain_type);
    if (params.query) lineupQuery = lineupQuery.ilike('name', `%${params.query}%`);
    const { data: lineupData, count } = await lineupQuery;
    lineupTotal = count ?? 0;
    lineup = (lineupData ?? []).map((it) => {
      const brand = it.brand as unknown as { name: string; slug: string; logo_url: string | null };
      return {
        id: it.id,
        name: it.name,
        strainType: it.strain_type,
        thcPercentage: it.thc_percentage,
        description: it.description,
        imageUrl: catalogImageSrc(it.id, it.image_url),
        brandName: brand.name,
        brandSlug: brand.slug,
        brandLogoUrl: brand.logo_url,
      };
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 space-y-4">
        <div>
          <p className="eyebrow mb-1">Shop the menu</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Products</h1>
        </div>
        <ProductFilters categories={categories ?? []} />
      </div>

      <p className="text-muted mb-4 text-sm">
        {total.toLocaleString()} on dispensary menus · {lineupTotal.toLocaleString()} in brand
        catalogs
      </p>

      {sponsored.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {sponsored.map((p) => (
            <ProductCard
              key={p.id}
              p={{
                name: p.name,
                brand: p.brand,
                priceCents: saleMap.get(p.id) ?? p.price_cents,
                originalPriceCents: saleMap.has(p.id) ? p.price_cents : null,
                imageUrl: cardImageUrl(p),
                strainType: p.strain_type,
                thcPercentage: p.thc_percentage,
                inStock: p.in_stock,
                rating: p.rating_avg,
                reviewCount: p.rating_count,
                productId: p.id,
                dispensarySlug: p.dispensary?.slug,
                sponsored: true,
                placementId: p.placementId || undefined,
              }}
            />
          ))}
        </div>
      )}

      {organic.length === 0 && sponsored.length === 0 ? (
        <div className="rounded-card border-border bg-surface border p-10 text-center">
          <p className="font-medium">No menu products found</p>
          <p className="text-muted mt-1 text-sm">
            {lineup.length > 0
              ? 'Nothing on dispensary menus matches — browse the brand catalogs below.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {organic.map((p) => (
            <ProductCard
              key={p.id}
              p={{
                name: p.name,
                brand: p.brand,
                priceCents: saleMap.get(p.id) ?? p.price_cents,
                originalPriceCents: saleMap.has(p.id) ? p.price_cents : null,
                imageUrl: p.image_urls[0] ?? catalogImageById.get(p.id) ?? null,
                strainType: p.strain_type,
                thcPercentage: p.thc_percentage,
                inStock: p.in_stock,
                rating: p.rating_avg,
                reviewCount: p.rating_count,
                productId: p.id,
                dispensarySlug: slugById.get(p.dispensary_id),
              }}
            />
          ))}
        </div>
      )}

      {lineup.length > 0 && (
        <section id="catalog" className="mt-10 scroll-mt-20">
          <h2 className="text-lg font-semibold">From brand catalogs</h2>
          <p className="text-muted mt-1 text-sm">
            {lineupTotal.toLocaleString()} products in official brand lineups — open a brand to see
            where it&apos;s carried.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {lineup.map((it) => (
              <LineupCard key={it.id} item={it} />
            ))}
          </div>
          {lineupTotal > CAT_PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              {catPage > 1 && (
                <a
                  href={`?${new URLSearchParams({
                    ...Object.fromEntries(
                      Object.entries(sp).filter(
                        (e): e is [string, string] => typeof e[1] === 'string',
                      ),
                    ),
                    cat_page: String(catPage - 1),
                  }).toString()}#catalog`}
                  className="border-border bg-surface hover:border-primary/50 rounded-full border px-4 py-2 font-medium transition-colors"
                >
                  ← Previous
                </a>
              )}
              <span className="text-muted">
                Page {catPage} of {Math.ceil(lineupTotal / CAT_PAGE_SIZE)}
              </span>
              {catPage * CAT_PAGE_SIZE < lineupTotal && (
                <a
                  href={`?${new URLSearchParams({
                    ...Object.fromEntries(
                      Object.entries(sp).filter(
                        (e): e is [string, string] => typeof e[1] === 'string',
                      ),
                    ),
                    cat_page: String(catPage + 1),
                  }).toString()}#catalog`}
                  className="border-border bg-surface hover:border-primary/50 rounded-full border px-4 py-2 font-medium transition-colors"
                >
                  Next →
                </a>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
