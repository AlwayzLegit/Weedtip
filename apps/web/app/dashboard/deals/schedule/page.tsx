import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { CalendarRange, Plus } from 'lucide-react';
import { DealsTabs } from '@/components/dashboard/deals-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { DEAL_LIFECYCLE_LABEL, type DealLifecycle, dealLifecycle } from '@/lib/deal-status';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Deals schedule' };

/** Timeline bar colour per lifecycle. */
const BAR: Record<DealLifecycle, string> = {
  live: 'bg-primary',
  scheduled: 'bg-warning',
  expired: 'bg-border-strong',
  inactive: 'bg-surface-2 border-border border border-dashed',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

/** Order sections present the most actionable state first. */
const SECTION_ORDER: DealLifecycle[] = ['live', 'scheduled', 'expired', 'inactive'];
const SECTION_TITLE: Record<DealLifecycle, string> = {
  live: 'Active now',
  scheduled: 'Upcoming',
  expired: 'Expired',
  inactive: 'Paused',
};

export default async function DealsSchedulePage() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { data } = await supabase
    .from('deals')
    .select('*')
    .eq('dispensary_id', dispensary.id)
    .order('start_date', { ascending: true });

  const deals = data ?? [];
  const now = Date.now();

  const withLife = deals.map((d) => ({ deal: d, life: dealLifecycle(d, now) }));
  const byLife = (l: DealLifecycle) => withLife.filter((x) => x.life === l);

  // Timeline range: span every deal window, and always include "now".
  const starts = deals.map((d) => new Date(d.start_date).getTime());
  const ends = deals.map((d) => new Date(d.end_date).getTime());
  const rangeStart = Math.min(now, ...starts);
  const rangeEnd = Math.max(now, ...ends);
  const span = Math.max(1, rangeEnd - rangeStart);
  const pct = (t: number) => ((t - rangeStart) / span) * 100;
  const nowPct = pct(now);

  const counts = SECTION_ORDER.map((l) => ({ l, n: byLife(l).length }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Specials</p>
          <h1 className="text-2xl font-bold">Deals schedule</h1>
          <p className="text-muted mt-1 text-sm">
            When each deal runs — active, upcoming, and expired at a glance.
          </p>
        </div>
        <Link href="/dashboard/deals/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Create special
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DealsTabs active="schedule" />
        <div className="text-muted flex flex-wrap gap-2 text-xs">
          {counts.map(({ l, n }) => (
            <Badge key={l} tone="muted">
              {SECTION_TITLE[l]}: {n}
            </Badge>
          ))}
        </div>
      </div>

      {deals.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No deals scheduled"
          description="Create a deal with a start and end date and it will appear on this timeline."
          action={{ href: '/dashboard/deals/new', label: 'Create a deal' }}
        />
      ) : (
        <>
          {/* Timeline */}
          <div className="rounded-card border-border bg-surface shadow-card border p-4">
            <div className="text-muted mb-3 flex justify-between text-xs">
              <span>{fmtDate(new Date(rangeStart).toISOString())}</span>
              <span>{fmtDate(new Date(rangeEnd).toISOString())}</span>
            </div>
            <div className="space-y-2.5">
              {withLife.map(({ deal, life }) => {
                const s = pct(new Date(deal.start_date).getTime());
                const e = pct(new Date(deal.end_date).getTime());
                const left = Math.max(0, Math.min(100, s));
                const width = Math.max(1.5, Math.min(100, e) - left);
                return (
                  <div key={deal.id} className="grid grid-cols-1 gap-1 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-3">
                    <Link
                      href={`/dashboard/deals/${deal.id}`}
                      className="hover:text-primary truncate text-sm font-medium"
                      title={deal.title}
                    >
                      {deal.title}
                    </Link>
                    <div className="bg-surface-2 relative h-5 w-full overflow-hidden rounded">
                      <div
                        className={`absolute top-0 h-full rounded ${BAR[life]}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${fmtDate(deal.start_date)} – ${fmtDate(deal.end_date)}`}
                      />
                      {/* now marker */}
                      {nowPct >= 0 && nowPct <= 100 && (
                        <div
                          className="bg-foreground/70 absolute top-0 h-full w-px"
                          style={{ left: `${nowPct}%` }}
                          aria-hidden
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-muted mt-3 flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="bg-primary h-2 w-3 rounded-sm" /> Active</span>
              <span className="flex items-center gap-1"><span className="bg-warning h-2 w-3 rounded-sm" /> Upcoming</span>
              <span className="flex items-center gap-1"><span className="bg-border-strong h-2 w-3 rounded-sm" /> Expired</span>
              <span className="flex items-center gap-1"><span className="bg-foreground/70 h-3 w-px" /> Now</span>
            </div>
          </div>

          {/* Grouped lists */}
          {SECTION_ORDER.map((life) => {
            const items = byLife(life);
            if (items.length === 0) return null;
            return (
              <section key={life} className="space-y-2">
                <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">
                  {SECTION_TITLE[life]} · {items.length}
                </h2>
                <div className="space-y-2">
                  {items.map(({ deal }) => (
                    <Link
                      key={deal.id}
                      href={`/dashboard/deals/${deal.id}`}
                      className="rounded-card border-border bg-surface hover:border-border-strong flex items-center justify-between gap-3 border p-3 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <StatusPill tone={life}>{DEAL_LIFECYCLE_LABEL[life]}</StatusPill>
                        <span className="truncate font-medium">{deal.title}</span>
                        {deal.code && (
                          <span className="border-primary/40 text-primary rounded border border-dashed px-1.5 py-0.5 font-mono text-xs">
                            {deal.code}
                          </span>
                        )}
                      </div>
                      <span className="text-muted shrink-0 text-xs whitespace-nowrap">
                        {fmtDate(deal.start_date)} – {fmtDate(deal.end_date)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
