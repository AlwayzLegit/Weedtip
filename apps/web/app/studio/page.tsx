import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Circle, Clock, Store } from 'lucide-react';
import { BrandManageForm } from '@/components/dashboard/brand-manage-form';
import { BrandPlanRequest } from '@/components/dashboard/brand-plan-request';
import { brandSetupProgress, brandSetupSteps } from '@/lib/brand-onboarding';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { canUseBrandFeature, getBrandTier } from '@/lib/brand-plan';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brand profile · Studio' };

export default async function StudioProfile() {
  const { brands } = await getBrandOwnerContext();
  const ids = brands.map((b) => b.id);

  const supabase = await createClient();
  const [{ data: prods }, { data: catalog }, { data: basicPlan }, { data: subs }, tiers] =
    await Promise.all([
      supabase
        .from('products')
        .select('id,brand_id, dispensary:dispensaries!inner(slug,name,status)')
        .in('brand_id', ids)
        .eq('dispensary.status', 'active'),
      // Owner's own catalog products (drives the "add your first product" step).
      supabase.from('brand_products').select('id,brand_id').in('brand_id', ids),
      supabase
        .from('plans')
        .select('id, price_cents')
        .eq('slug', 'pro')
        .eq('is_active', true)
        .maybeSingle(),
      supabase.from('brand_subscriptions').select('brand_id, status').in('brand_id', ids),
      Promise.all(brands.map(async (b) => [b.id, await getBrandTier(b.id)] as const)),
    ]);

  const basic = basicPlan ? { id: basicPlan.id, priceCents: basicPlan.price_cents } : null;
  const subStatus = new Map((subs ?? []).map((s) => [s.brand_id, s.status]));
  const tierByBrand = new Map(tiers);

  // brand_id → number of catalog products the owner has added.
  const catalogCount = new Map<string, number>();
  for (const p of catalog ?? []) {
    if (p.brand_id) catalogCount.set(p.brand_id, (catalogCount.get(p.brand_id) ?? 0) + 1);
  }

  // Description + website are Basic-tier ("complete profile") per brand.
  const canCompleteByBrand = new Map(
    await Promise.all(
      brands.map(
        async (b) => [b.id, await canUseBrandFeature(b.id, 'brand_complete_profile')] as const,
      ),
    ),
  );

  // brand_id → { products, shops }
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
        <h1 className="text-2xl font-bold sm:text-3xl">Profile &amp; media</h1>
        <p className="text-muted mt-1 text-sm">
          Your brand profile enriches every dispensary menu that carries you.
        </p>
      </div>

      {brands.map((b) => {
        const c = carried.get(b.id);
        const steps = brandSetupSteps(b, { products: catalogCount.get(b.id) ?? 0 });
        const { done, total } = brandSetupProgress(steps);
        return (
          <section key={b.id} className="card space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{b.name}</h2>
              {b.status === 'active' ? (
                <Link href={`/brand/${b.slug}`} className="text-primary text-sm hover:underline">
                  View public page →
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  <Clock className="h-3.5 w-3.5" /> Pending review
                </span>
              )}
            </div>

            <BrandPlanRequest
              brandId={b.id}
              isPaid={(tierByBrand.get(b.id) ?? 'free') !== 'free'}
              pending={subStatus.get(b.id) === 'pending'}
              basic={basic}
            />

            {done < total && (
              <div className="rounded-card border-border bg-surface-2 border p-4">
                <p className="text-sm font-semibold">
                  Finish setting up your brand ({done}/{total})
                </p>
                <ul className="mt-2 space-y-1.5">
                  {steps.map((s) => (
                    <li key={s.key} className="flex items-center gap-2 text-sm">
                      {s.done ? (
                        <CheckCircle2 className="text-primary h-4 w-4 shrink-0" />
                      ) : (
                        <Circle className="text-muted h-4 w-4 shrink-0" />
                      )}
                      <span className={s.done ? 'text-muted line-through' : ''}>{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <BrandManageForm brand={b} canComplete={canCompleteByBrand.get(b.id) ?? false} />

            <div className="border-border border-t pt-4">
              <h3 className="text-muted mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
                <Store className="h-4 w-4" /> Carried at ({c?.shops.size ?? 0} shops ·{' '}
                {c?.products ?? 0} products)
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
          </section>
        );
      })}
    </div>
  );
}
