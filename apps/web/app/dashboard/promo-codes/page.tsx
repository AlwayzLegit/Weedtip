import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { Pencil, Ticket } from 'lucide-react';
import type { Tables } from '@weedtip/supabase/types';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { UpgradeBanner } from '@/components/dashboard/upgrade-wall';
import { DEAL_LIFECYCLE_LABEL, dealLifecycle } from '@/lib/deal-status';
import { getOwnerFeature } from '@/lib/features';
import { requireMemberCapability } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Promo codes' };

const PAGE_SIZE = 20;

/** Compact discount label for a code deal. */
function discountLabel(d: Tables<'deals'>): string {
  switch (d.kind) {
    case 'percentage':
      return `${d.discount_value}% off`;
    case 'fixed_amount':
      return `$${d.discount_value} off`;
    case 'spend_threshold':
      return `${d.discount_value}% off order`;
    default:
      return `${d.discount_value}% off`;
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'Anyone',
  first_time: 'First-time',
  return: 'Returning',
};

export default async function PromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { dispensary } = await requireMemberCapability('marketing');
  const isPaid = await getOwnerFeature('deals');
  const supabase = await createClient();

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Code-based deals only (a promo code is a deal with a `code`), newest first.
  const [{ data: deals, count }, { data: redemptions }] = await Promise.all([
    supabase
      .from('deals')
      .select('*', { count: 'exact' })
      .eq('dispensary_id', dispensary.id)
      .not('code', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase.from('deal_redemptions').select('deal_id').eq('dispensary_id', dispensary.id),
  ]);

  const total = count ?? 0;
  const rows = deals ?? [];

  // Redemption counts per deal (across all this shop's redemptions).
  const redemptionCount = new Map<string, number>();
  for (const r of redemptions ?? []) {
    redemptionCount.set(r.deal_id, (redemptionCount.get(r.deal_id) ?? 0) + 1);
  }

  const columns: Column<Tables<'deals'>>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (d) => (
        <span className="border-primary/40 text-primary inline-block rounded border border-dashed px-1.5 py-0.5 font-mono text-xs font-medium">
          {d.code}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Deal',
      cell: (d) => <span className="font-medium">{d.title}</span>,
      className: 'max-w-[16rem] truncate',
    },
    { key: 'discount', header: 'Discount', cell: (d) => <span className="text-muted">{discountLabel(d)}</span> },
    {
      key: 'audience',
      header: 'Audience',
      cell: (d) => <span className="text-muted">{AUDIENCE_LABEL[d.audience] ?? 'Anyone'}</span>,
    },
    {
      key: 'dates',
      header: 'Dates',
      cell: (d) => (
        <span className="text-muted whitespace-nowrap">
          {fmtDate(d.start_date)} – {fmtDate(d.end_date)}
        </span>
      ),
    },
    {
      key: 'redemptions',
      header: 'Redemptions',
      cell: (d) => {
        const used = redemptionCount.get(d.id) ?? 0;
        const cap = d.total_limit;
        const pct = cap && cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
        return (
          <div className="min-w-[6rem]">
            <span className="tabular-nums">
              {used}
              <span className="text-muted"> / {cap ?? '∞'}</span>
            </span>
            {cap != null && (
              <div className="bg-surface-2 mt-1 h-1 w-full overflow-hidden rounded-full">
                <div
                  className={pct >= 100 ? 'bg-danger h-full' : 'bg-primary h-full'}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {d.per_customer_limit != null && (
              <span className="text-muted text-[11px]">max {d.per_customer_limit}/customer</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (d) => {
        const life = dealLifecycle(d);
        return <StatusPill tone={life}>{DEAL_LIFECYCLE_LABEL[life]}</StatusPill>;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (d) => (
        <Link href={`/dashboard/deals/${d.id}`}>
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Edit</span>
          </Button>
        </Link>
      ),
    },
  ];

  const shownFrom = total === 0 ? 0 : from + 1;
  const shownTo = Math.min(from + rows.length, total);
  const hasPrev = page > 1;
  const hasNext = to + 1 < total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Marketing</p>
          <h1 className="text-2xl font-bold">Promo codes</h1>
          <p className="text-muted mt-1 text-sm">
            Trackable checkout codes and how close each is to its redemption cap.
          </p>
        </div>
        <Link href="/dashboard/deals/new">
          <Button size="sm">
            <Ticket className="h-4 w-4" /> New promo code
          </Button>
        </Link>
      </div>

      {!isPaid && (
        <UpgradeBanner message="Promo codes are a Growth feature. You can review existing codes, but publishing new ones needs an upgrade." />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No promo codes yet"
          description="Create a deal with a code (like SAVE20) and it will show up here with live redemption counts."
          action={{ href: '/dashboard/deals/new', label: 'Create a promo code' }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(d) => d.id}
          footer={
            <>
              <span>
                Showing {shownFrom}–{shownTo} of {total}
              </span>
              <span className="flex items-center gap-1">
                {hasPrev && (
                  <Link href={`/dashboard/promo-codes?page=${page - 1}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {hasNext && (
                  <Link href={`/dashboard/promo-codes?page=${page + 1}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </span>
            </>
          }
        />
      )}
    </div>
  );
}
