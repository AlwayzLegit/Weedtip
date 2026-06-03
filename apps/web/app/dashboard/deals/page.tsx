import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { deleteDeal } from '@/app/dashboard/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Deals' };

function discountLabel(type: string, value: number): string {
  if (type === 'percentage') return `${value}% off`;
  if (type === 'fixed') return `$${value} off`;
  return 'BOGO';
}

export default async function DashboardDeals() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const [{ data: deals }, { data: redemptions }] = await Promise.all([
    supabase
      .from('deals')
      .select('*')
      .eq('dispensary_id', dispensary.id)
      .order('end_date', { ascending: false }),
    supabase
      .from('deal_redemptions')
      .select('deal_id')
      .eq('dispensary_id', dispensary.id),
  ]);

  const redemptionCount = new Map<string, number>();
  for (const r of redemptions ?? []) {
    redemptionCount.set(r.deal_id, (redemptionCount.get(r.deal_id) ?? 0) + 1);
  }

  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deals</h1>
        <Link href="/dashboard/deals/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Create deal
          </Button>
        </Link>
      </div>

      {!deals || deals.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No deals yet.
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => {
            const live =
              deal.is_active &&
              new Date(deal.start_date).getTime() <= now &&
              new Date(deal.end_date).getTime() >= now;
            return (
              <div
                key={deal.id}
                className="rounded-card border-border bg-surface flex items-center justify-between border p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{deal.title}</p>
                    <Badge tone={live ? 'primary' : 'muted'}>{live ? 'Live' : 'Inactive'}</Badge>
                  </div>
                  <p className="text-muted mt-1 text-sm">
                    {discountLabel(deal.discount_type, deal.discount_value)} ·{' '}
                    {new Date(deal.start_date).toLocaleDateString()} –{' '}
                    {new Date(deal.end_date).toLocaleDateString()}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {deal.code && (
                      <span className="border-primary/40 text-primary rounded border border-dashed px-1.5 py-0.5 font-mono text-xs font-medium">
                        {deal.code}
                      </span>
                    )}
                    <span className="text-muted text-xs">
                      {redemptionCount.get(deal.id) ?? 0} redemption
                      {(redemptionCount.get(deal.id) ?? 0) === 1 ? '' : 's'}
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
