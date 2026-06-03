import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Megaphone, Store } from 'lucide-react';
import { BrandManageForm } from '@/components/dashboard/brand-manage-form';
import { BrandPromote } from '@/components/dashboard/brand-promote';
import { Badge } from '@/components/ui/badge';
import { getAuth } from '@/lib/auth';
import { formatPrice } from '@/lib/format';
import { isStripeConfigured } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brands' };

const BILLING_BANNER: Record<string, string> = {
  placement: 'Payment received — your brand promotion goes live momentarily.',
  cancel: 'Checkout canceled. No charge was made.',
};

function isLive(p: { is_active: boolean; starts_at: string; ends_at: string | null }): boolean {
  const now = Date.now();
  return (
    p.is_active &&
    new Date(p.starts_at).getTime() <= now &&
    (!p.ends_at || new Date(p.ends_at).getTime() >= now)
  );
}

export default async function DashboardBrands({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { user } = await getAuth();
  if (!user) redirect('/sign-in');

  const { billing } = await searchParams;
  const banner = billing ? BILLING_BANNER[billing] : undefined;

  const supabase = await createClient();
  const { data: brands } = await supabase
    .from('brands')
    .select('id,name,slug,description,logo_url,website')
    .eq('owner_id', user.id)
    .order('name');

  const ids = (brands ?? []).map((b) => b.id);
  const promos = ids.length
    ? (
        await supabase
          .from('placements')
          .select('id,brand_id,is_active,starts_at,ends_at,price_cents')
          .eq('type', 'promoted_brand')
          .in('brand_id', ids)
          .order('created_at', { ascending: false })
      ).data
    : null;
  type BrandPromo = NonNullable<typeof promos>[number];
  const promosByBrand = new Map<string, BrandPromo[]>();
  for (const p of promos ?? []) {
    if (!p.brand_id) continue;
    const list = promosByBrand.get(p.brand_id) ?? [];
    list.push(p);
    promosByBrand.set(p.brand_id, list);
  }
  const { data: prods } = ids.length
    ? await supabase
        .from('products')
        .select('id,brand_id, dispensary:dispensaries!inner(slug,name,status)')
        .in('brand_id', ids)
        .eq('dispensary.status', 'active')
    : { data: [] };

  // brand_id → { products, dispensaries }
  const carried = new Map<string, { products: number; shops: Map<string, string> }>();
  for (const p of prods ?? []) {
    if (!p.brand_id) continue;
    const entry = carried.get(p.brand_id) ?? { products: 0, shops: new Map() };
    entry.products += 1;
    const d = p.dispensary as { slug: string; name: string } | null;
    if (d) entry.shops.set(d.slug, d.name);
    carried.set(p.brand_id, entry);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Brand SaaS</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Your brands</h1>
        <p className="text-muted mt-1 text-sm">
          Manage the brands you own — your profile enriches every menu that carries you.
        </p>
      </div>

      {banner && (
        <p className="border-primary/40 bg-primary-muted text-primary rounded-card border px-4 py-2 text-sm">
          {banner}
        </p>
      )}

      {!brands || brands.length === 0 ? (
        <div className="card text-muted p-10 text-center text-sm">
          You don&apos;t own any brands yet. Find your brand under{' '}
          <Link href="/brands" className="text-primary hover:underline">
            Brands
          </Link>{' '}
          and click “Claim this brand” — an admin will review it.
        </div>
      ) : (
        brands.map((b) => {
          const c = carried.get(b.id);
          return (
            <section key={b.id} className="card space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{b.name}</h2>
                <Link href={`/brand/${b.slug}`} className="text-primary text-sm hover:underline">
                  View public page →
                </Link>
              </div>

              <BrandManageForm brand={b} />

              <div className="border-border border-t pt-4">
                <h3 className="text-muted mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
                  <Store className="h-4 w-4" /> Carried at ({c?.shops.size ?? 0} shops · {c?.products ?? 0} products)
                </h3>
                {c && c.shops.size > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {[...c.shops.entries()].map(([slug, name]) => (
                      <Link
                        key={slug}
                        href={`/dispensary/${slug}`}
                        className="border-border bg-surface-2 hover:border-primary/50 rounded-full border px-3 py-1 text-sm transition-colors"
                      >
                        {name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-sm">No active dispensaries carry this brand yet.</p>
                )}
              </div>

              <div className="border-border border-t pt-4">
                <h3 className="text-muted mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
                  <Megaphone className="h-4 w-4" /> Promote
                </h3>
                {(() => {
                  const live = (promosByBrand.get(b.id) ?? []).filter(isLive);
                  return (
                    <div className="space-y-3">
                      {live.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge tone="primary">Live</Badge>
                          {live.map((p) => (
                            <span key={p.id} className="text-muted">
                              {formatPrice(p.price_cents)}
                              {p.ends_at
                                ? ` · until ${new Date(p.ends_at).toLocaleDateString()}`
                                : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      <BrandPromote brandId={b.id} stripeEnabled={isStripeConfigured} />
                    </div>
                  );
                })()}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
