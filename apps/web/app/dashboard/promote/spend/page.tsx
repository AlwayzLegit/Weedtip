import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, ReceiptText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Marketing spend' };

const TYPE_LABEL: Record<string, string> = {
  featured: 'Featured placement',
  hero: 'Homepage spotlight',
  promoted_deal: 'Promoted deal',
  promoted_product: 'Promoted product',
};

/** First day of the month for a YYYY-MM key (UTC). */
function monthStart(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
}
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string): string {
  return monthStart(key).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** [start, end) window overlap check for a term with an open end. */
function overlaps(startIso: string | null, endIso: string | null, start: Date, end: Date): boolean {
  const s = startIso ? new Date(startIso).getTime() : 0;
  const e = endIso ? new Date(endIso).getTime() : Number.POSITIVE_INFINITY;
  return s < end.getTime() && e >= start.getTime();
}

type LineItem = {
  kind: 'Plan' | 'Placement' | 'Region ad slot';
  label: string;
  detail: string;
  cents: number;
  cadence: 'monthly' | 'term';
  live: boolean;
};

/**
 * Marketing-spend report (P3): everything the shop pays Weedtip for in a given
 * month — plan subscription, promoted placements, and region ad slots — with a
 * month filter. Sales-led billing has no invoice ledger, so this reports the
 * committed price of everything ACTIVE during the selected month.
 */
export default async function MarketingSpendPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const now = new Date();
  const sp = await searchParams;
  const selected = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : monthKey(now);
  const start = monthStart(selected);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const [{ data: sub }, { data: placements }, { data: adSubs }] = await Promise.all([
    supabase
      .from('dispensary_subscriptions')
      .select('status, created_at, plan:plans(name, price_cents)')
      .eq('dispensary_id', dispensary.id)
      .maybeSingle(),
    supabase
      .from('placements')
      .select('id, type, price_cents, starts_at, ends_at, is_active, scope_city, scope_state')
      .eq('dispensary_id', dispensary.id)
      .order('starts_at', { ascending: false }),
    supabase
      .from('ad_subscriptions')
      .select(
        'id, price_paid, status, starts_at, ends_at, created_at, slot:ad_slots(slot_type, region:ad_regions(name))',
      )
      .eq('dispensary_id', dispensary.id),
  ]);

  const items: LineItem[] = [];

  const plan = sub?.plan as { name: string; price_cents: number } | null;
  if (
    sub &&
    plan &&
    plan.price_cents > 0 &&
    sub.status === 'active' &&
    new Date(sub.created_at).getTime() < end.getTime()
  ) {
    items.push({
      kind: 'Plan',
      label: `${plan.name} plan`,
      detail: 'Subscription',
      cents: plan.price_cents,
      cadence: 'monthly',
      live: true,
    });
  }

  for (const p of placements ?? []) {
    if (!p.is_active || !overlaps(p.starts_at, p.ends_at, start, end)) continue;
    const scope = p.scope_city ?? p.scope_state ?? 'Sitewide';
    const term = `${new Date(p.starts_at).toLocaleDateString()} – ${
      p.ends_at ? new Date(p.ends_at).toLocaleDateString() : 'open'
    }`;
    items.push({
      kind: 'Placement',
      label: TYPE_LABEL[p.type] ?? p.type,
      detail: `${scope} · ${term}`,
      cents: p.price_cents,
      cadence: 'term',
      live: overlaps(p.starts_at, p.ends_at, new Date(), new Date(Date.now() + 1)),
    });
  }

  for (const a of adSubs ?? []) {
    if (a.status !== 'active' || !overlaps(a.starts_at ?? a.created_at, a.ends_at, start, end))
      continue;
    const slot = a.slot as { slot_type: string; region: { name: string } | null } | null;
    items.push({
      kind: 'Region ad slot',
      label: `${slot?.slot_type ?? 'slot'} · ${slot?.region?.name ?? 'region'}`,
      detail: 'Region advertising',
      cents: a.price_paid,
      cadence: 'monthly',
      live: true,
    });
  }

  const monthlyTotal = items
    .filter((i) => i.cadence === 'monthly')
    .reduce((s, i) => s + i.cents, 0);
  const termTotal = items.filter((i) => i.cadence === 'term').reduce((s, i) => s + i.cents, 0);

  // Last 12 months for the filter row, newest first.
  const months = Array.from({ length: 12 }, (_, i) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Promote</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ReceiptText className="text-primary h-7 w-7" /> Marketing spend
        </h1>
        <p className="text-muted mt-1 text-sm">
          Everything {dispensary.name} pays for on Weedtip in a month — plan, placements, and
          region ads. Committed prices for whatever was active during the month.
        </p>
      </div>

      {/* Month filter */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        {months.map((m) => (
          <Link
            key={m}
            href={`/dashboard/promote/spend?month=${m}`}
            className={
              'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ' +
              (m === selected
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground')
            }
          >
            {monthLabel(m)}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-primary text-2xl font-bold">{formatPrice(monthlyTotal)}</p>
          <p className="text-muted mt-0.5 text-sm">Monthly recurring in {monthLabel(selected)}</p>
        </div>
        <div className="card p-5">
          <p className="text-2xl font-bold">{formatPrice(termTotal)}</p>
          <p className="text-muted mt-0.5 text-sm">Fixed-term placements overlapping the month</p>
        </div>
        <div className="card p-5">
          <p className="text-2xl font-bold">{items.length}</p>
          <p className="text-muted mt-0.5 text-sm">Active line items</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {items.length === 0 ? (
          <div className="text-muted p-10 text-center text-sm">
            No marketing spend in {monthLabel(selected)}. Your free listing stays live at 0%
            commission —{' '}
            <Link href="/dashboard/promote" className="text-primary hover:underline">
              explore ways to promote
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted border-b text-left text-xs uppercase tracking-wide">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {items.map((i, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{i.label}</span>
                    <Badge tone="muted" className="ml-2">
                      {i.kind}
                    </Badge>
                  </td>
                  <td className="text-muted px-4 py-3">{i.detail}</td>
                  <td className="text-muted px-4 py-3">
                    {i.cadence === 'monthly' ? 'Monthly' : 'One-time term'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatPrice(i.cents)}
                    {i.cadence === 'monthly' && <span className="text-muted font-normal">/mo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-muted flex items-center gap-1.5 text-xs">
        <BarChart3 className="h-3.5 w-3.5" />
        Want performance next to spend? See{' '}
        <Link href="/dashboard/analytics" className="text-primary hover:underline">
          Analytics
        </Link>
        .
      </p>
    </div>
  );
}
