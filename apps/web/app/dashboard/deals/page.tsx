import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import type { Tables } from '@weedtip/supabase/types';
import { deleteDeal } from '@/app/dashboard/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Deals' };

/** Human label for a special based on its kind + values. */
function kindLabel(d: Tables<'deals'>): string {
  switch (d.kind) {
    case 'percentage':
      return `${d.discount_value}% off`;
    case 'fixed_amount':
      return `$${d.discount_value} off`;
    case 'price_target':
      return d.target_price_cents != null ? `${formatPrice(d.target_price_cents)} price` : 'Set price';
    case 'spend_threshold':
      return `Spend ${formatPrice(d.min_subtotal_cents ?? 0)} → ${d.discount_value}% off order`;
    case 'bogo':
      return 'Buy one get one';
    default:
      return `${d.discount_value}% off`;
  }
}

/** How the special is applied — surfaces the mechanism at a glance. */
function mechanism(d: Tables<'deals'>): { label: string; tone: 'primary' | 'muted' | 'outline' } {
  if (d.kind === 'spend_threshold') return { label: 'Auto · order', tone: 'primary' };
  if (d.auto_apply) {
    const scope =
      d.target_scope === 'category'
        ? `${d.target_category_ids.length} categories`
        : d.target_scope === 'products'
          ? `${d.target_product_ids.length} products`
          : 'entire menu';
    return { label: `Auto · ${scope}`, tone: 'primary' };
  }
  if (d.code) return { label: 'Promo code', tone: 'outline' };
  return { label: 'Manual', tone: 'muted' };
}

export default async function DashboardDeals() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const [{ data: deals }, { data: redemptions }] = await Promise.all([
    supabase.from('deals').select('*').eq('dispensary_id', dispensary.id).order('end_date', {
      ascending: false,
    }),
    supabase.from('deal_redemptions').select('deal_id').eq('dispensary_id', dispensary.id),
  ]);

  const redemptionCount = new Map<string, number>();
  for (const r of redemptions ?? []) {
    redemptionCount.set(r.deal_id, (redemptionCount.get(r.deal_id) ?? 0) + 1);
  }

  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Specials</p>
          <h1 className="text-2xl font-bold">Deals &amp; specials</h1>
        </div>
        <Link href="/dashboard/deals/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Create special
          </Button>
        </Link>
      </div>

      {!deals || deals.length === 0 ? (
        <div className="card text-muted p-10 text-center">
          No specials yet. Create a storefront sale, promo code, or spend &amp; save offer.
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => {
            const live =
              deal.is_active &&
              new Date(deal.start_date).getTime() <= now &&
              new Date(deal.end_date).getTime() >= now;
            const m = mechanism(deal);
            const reds = redemptionCount.get(deal.id) ?? 0;
            return (
              <div
                key={deal.id}
                className="rounded-card border-border bg-surface shadow-card hover:border-border-strong flex items-center justify-between border p-4 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{deal.title}</p>
                    <Badge tone={live ? 'primary' : 'muted'}>{live ? 'Live' : 'Inactive'}</Badge>
                    {deal.featured && <Badge tone="outline">Featured</Badge>}
                  </div>
                  <p className="text-muted mt-1 text-sm">
                    {kindLabel(deal)} · {new Date(deal.start_date).toLocaleDateString()} –{' '}
                    {new Date(deal.end_date).toLocaleDateString()}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={m.tone}>{m.label}</Badge>
                    {deal.code && (
                      <span className="border-primary/40 text-primary rounded border border-dashed px-1.5 py-0.5 font-mono text-xs font-medium">
                        {deal.code}
                      </span>
                    )}
                    <span className="text-muted text-xs">
                      {reds} redemption{reds === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/deals/${deal.id}`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only">Edit</span>
                    </Button>
                  </Link>
                  <DeleteButton
                    action={deleteDeal.bind(null, deal.id)}
                    confirmText={`Delete "${deal.title}"?`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
