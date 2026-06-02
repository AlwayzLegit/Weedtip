import type { Metadata } from 'next';
import Link from 'next/link';
import { Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Deals',
  description: 'Live cannabis deals and discounts from licensed dispensaries near you on Weedtip.',
  path: '/deals',
});

function discountLabel(type: string, value: number): string {
  if (type === 'percentage') return `${value}% off`;
  if (type === 'fixed') return `$${value} off`;
  return 'BOGO';
}

export default async function DealsPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: deals } = await supabase
    .from('deals')
    .select('*, dispensary:dispensaries!inner(slug,name,city,state,status)')
    .eq('is_active', true)
    .lte('start_date', nowIso)
    .gte('end_date', nowIso)
    .eq('dispensary.status', 'active')
    .order('end_date');

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Deals</h1>
        <p className="text-muted mt-1">Live discounts from dispensaries near you.</p>
      </div>

      {!deals || deals.length === 0 ? (
        <div className="rounded-card border-border bg-surface border p-10 text-center">
          <Tag className="text-muted mx-auto h-8 w-8" />
          <p className="mt-2 font-medium">No active deals right now</p>
          <p className="text-muted mt-1 text-sm">Check back soon for fresh offers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {deals.map((deal) => {
            const dispensary = deal.dispensary as {
              slug: string;
              name: string;
              city: string;
              state: string;
            } | null;
            return (
              <Link
                key={deal.id}
                href={dispensary ? `/dispensary/${dispensary.slug}` : '#'}
                className="rounded-card border-primary/30 bg-primary-muted hover:border-primary flex items-start justify-between gap-3 border p-5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-primary font-semibold">{deal.title}</p>
                  {deal.description && (
                    <p className="text-muted mt-1 line-clamp-2 text-sm">{deal.description}</p>
                  )}
                  {dispensary && (
                    <p className="text-muted mt-2 text-xs">
                      {dispensary.name} · {dispensary.city}, {dispensary.state}
                    </p>
                  )}
                </div>
                <Badge tone="primary" className="shrink-0">
                  {discountLabel(deal.discount_type, deal.discount_value)}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
