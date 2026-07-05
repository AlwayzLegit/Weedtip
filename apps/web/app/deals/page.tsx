import { MarketBanner } from '@/components/market-banner';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Tag } from 'lucide-react';
import { PlacementBeacon } from '@/components/placement-beacon';
import { Badge } from '@/components/ui/badge';
import { dealBadge } from '@/lib/format';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Deals',
  description: 'Live cannabis deals and discounts from licensed dispensaries near you on Weedtip.',
  path: '/deals',
});

type DealDispensary = { slug: string; name: string; city: string; state: string } | null;
type DealRow = {
  id: string;
  title: string;
  description: string | null;
  code: string | null;
  discount_type: string;
  discount_value: number;
  dispensary: DealDispensary;
};

function DealTile({
  deal,
  sponsored,
  placementId,
}: {
  deal: DealRow;
  sponsored?: boolean;
  placementId?: string;
}) {
  const dispensary = deal.dispensary;
  return (
    <Link
      href={dispensary ? `/dispensary/${dispensary.slug}` : '#'}
      className="rounded-card border-primary/25 bg-primary-subtle hover:border-primary/60 hover:shadow-card-hover flex items-start justify-between gap-3 border p-5 transition-all duration-200 hover:-translate-y-0.5"
    >
      {placementId && <PlacementBeacon placementId={placementId} />}
      <div className="min-w-0">
        {sponsored && (
          <Badge tone="outline" className="mb-1.5">
            Sponsored
          </Badge>
        )}
        <p className="text-primary font-semibold">{deal.title}</p>
        {deal.description && (
          <p className="text-muted mt-1 line-clamp-2 text-sm">{deal.description}</p>
        )}
        {deal.code && (
          <p className="mt-2 text-xs">
            <span className="border-primary/40 text-primary rounded border border-dashed px-1.5 py-0.5 font-mono font-medium">
              {deal.code}
            </span>
          </p>
        )}
        {dispensary && (
          <p className="text-muted mt-2 text-xs">
            {dispensary.name} · {dispensary.city}, {dispensary.state}
          </p>
        )}
      </div>
      <Badge tone="primary" className="shrink-0">
        {dealBadge(deal.discount_type, deal.discount_value)}
      </Badge>
    </Link>
  );
}

export default async function DealsPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const DEAL_SELECT = '*, dispensary:dispensaries!inner(slug,name,city,state,status)';

  // Live promoted-deal placements → the sponsored rail.
  const { data: promos } = await supabase
    .from('placements')
    .select('id, target_id, priority')
    .eq('type', 'promoted_deal')
    .eq('is_active', true)
    .lte('starts_at', nowIso)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('priority', { ascending: false });

  const promoIds = (promos ?? []).map((p) => p.target_id).filter((id): id is string => !!id);

  const [{ data: sponsoredDeals }, { data: deals }] = await Promise.all([
    promoIds.length
      ? supabase
          .from('deals')
          .select(DEAL_SELECT)
          .in('id', promoIds)
          .eq('is_active', true)
          .lte('start_date', nowIso)
          .gte('end_date', nowIso)
          .eq('dispensary.status', 'active')
      : Promise.resolve({ data: [] as DealRow[] }),
    supabase
      .from('deals')
      .select(DEAL_SELECT)
      .eq('is_active', true)
      .lte('start_date', nowIso)
      .gte('end_date', nowIso)
      .eq('dispensary.status', 'active')
      .order('end_date'),
  ]);

  // Order sponsored by placement priority and keep them out of the main grid.
  const priorityOf = new Map((promos ?? []).map((p) => [p.target_id, p.priority] as const));
  const placementOf = new Map(
    (promos ?? []).map((p) => [p.target_id, p.id] as const),
  );
  const sponsored = ((sponsoredDeals as DealRow[]) ?? []).sort(
    (a, b) => (priorityOf.get(b.id) ?? 0) - (priorityOf.get(a.id) ?? 0),
  );
  const sponsoredIds = new Set(sponsored.map((d) => d.id));
  const rest = ((deals as DealRow[]) ?? []).filter((d) => !sponsoredIds.has(d.id));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <p className="eyebrow mb-1">Save today</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Deals</h1>
      <MarketBanner hrefPrefix="/deals" label="deals" />
        <p className="text-muted mt-1">Live discounts from dispensaries near you.</p>
      </div>

      {sponsored.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sponsored.map((deal) => (
            <DealTile
              key={deal.id}
              deal={deal}
              sponsored
              placementId={placementOf.get(deal.id) ?? undefined}
            />
          ))}
        </div>
      )}

      {rest.length === 0 && sponsored.length === 0 ? (
        <div className="rounded-card border-border bg-surface border p-10 text-center">
          <Tag className="text-muted mx-auto h-8 w-8" />
          <p className="mt-2 font-medium">No active deals right now</p>
          <p className="text-muted mt-1 text-sm">Check back soon for fresh offers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rest.map((deal) => (
            <DealTile key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </main>
  );
}
