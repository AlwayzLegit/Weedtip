'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Images, Loader2, Package, Sparkles } from 'lucide-react';
import {
  activateMerchSubscription,
  compMerchSlot,
  endMerchSubscription,
} from '@/app/admin/merch-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';

export type MerchRow = {
  id: string;
  status: 'active' | 'pending';
  slotType: 'brand' | 'product' | 'hero';
  position: number;
  regionName: string;
  targetName: string;
  advertiserName: string | null;
  isHouse: boolean;
  priceCents: number;
  endsAt: string | null;
};

export type RegionOption = { slug: string; name: string; state: string | null };

function Row({ r }: { r: MerchRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isPending = r.status === 'pending';
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="rounded-card border-border bg-surface flex flex-wrap items-center justify-between gap-3 border p-4">
      <div className="min-w-0">
        <p className="font-medium">
          {r.targetName}{' '}
          <span className="text-muted text-xs font-normal">· slot #{r.position}</span>
        </p>
        <p className="text-muted mt-0.5 text-xs">
          {r.regionName}
          {r.isHouse ? ' · house (comped)' : ` · ${formatPrice(r.priceCents)}`}
          {r.advertiserName ? ` · via ${r.advertiserName}` : ''}
          {r.endsAt ? ` · until ${new Date(r.endsAt).toLocaleDateString()}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={isPending ? 'outline' : 'primary'}>{isPending ? 'Pending' : 'Live'}</Badge>
        {isPending ? (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => activateMerchSubscription(r.id))}
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => endMerchSubscription(r.id))}
            >
              Reject
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => endMerchSubscription(r.id))}
          >
            End
          </Button>
        )}
      </div>
    </div>
  );
}

function CompForm({ regions }: { regions: RegionOption[] }) {
  const router = useRouter();
  const [entity, setEntity] = useState<'brand' | 'product' | 'hero'>('brand');
  const [heroTarget, setHeroTarget] = useState<'dispensary' | 'brand'>('dispensary');
  const [ref, setRef] = useState('');
  const [regionSlug, setRegionSlug] = useState('nationwide');
  const [days, setDays] = useState(30);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refLabel =
    entity === 'product'
      ? 'Product id'
      : entity === 'hero'
        ? heroTarget === 'brand'
          ? 'Brand slug'
          : 'Dispensary slug'
        : 'Brand slug';
  const refPlaceholder =
    entity === 'product' ? 'UUID' : heroTarget === 'brand' ? 'raw-garden' : 'green-cross';

  // Group regions by state for the picker; nationwide floats to the top.
  const grouped = useMemo(() => {
    const byState = new Map<string, RegionOption[]>();
    for (const r of regions) {
      if (r.slug === 'nationwide') continue;
      const key = r.state ?? '—';
      if (!byState.has(key)) byState.set(key, []);
      byState.get(key)!.push(r);
    }
    return [...byState.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [regions]);

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Gift className="text-primary h-4 w-4" />
        <h2 className="text-lg font-semibold">Comp a featured slot</h2>
      </div>
      <p className="text-muted text-sm">
        Place a brand, product, or homepage hero into a region&apos;s inventory for free. Fills the
        next open slot and goes live immediately; nationwide is the homepage-wide default region.
      </p>
      {error && (
        <p className="border-danger/30 bg-danger/10 text-danger rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p className="border-primary/30 bg-primary-muted text-primary rounded-md border px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Type</span>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value as 'brand' | 'product' | 'hero')}
            className="border-border bg-background block w-32 rounded-md border px-3 py-2"
          >
            <option value="brand">Brand</option>
            <option value="product">Product</option>
            <option value="hero">Hero</option>
          </select>
        </label>
        {entity === 'hero' && (
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Advertiser</span>
            <select
              value={heroTarget}
              onChange={(e) => setHeroTarget(e.target.value as 'dispensary' | 'brand')}
              className="border-border bg-background block w-32 rounded-md border px-3 py-2"
            >
              <option value="dispensary">Dispensary</option>
              <option value="brand">Brand</option>
            </select>
          </label>
        )}
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{refLabel}</span>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value.trim())}
            placeholder={refPlaceholder}
            className="border-border bg-background block w-64 rounded-md border px-3 py-2"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Region</span>
          <select
            value={regionSlug}
            onChange={(e) => setRegionSlug(e.target.value)}
            className="border-border bg-background block w-56 rounded-md border px-3 py-2"
          >
            <option value="nationwide">Nationwide (default)</option>
            {grouped.map(([state, list]) => (
              <optgroup key={state} label={state}>
                {list.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Days</span>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) =>
              setDays(Math.min(365, Math.max(1, Math.round(Number(e.target.value) || 0))))
            }
            className="border-border bg-background block w-20 rounded-md border px-3 py-2"
          />
        </label>
        <Button
          disabled={busy || !ref}
          onClick={() => {
            setError(null);
            setNotice(null);
            start(async () => {
              const res = await compMerchSlot({
                entity,
                ref,
                region_slug: regionSlug,
                days,
                ...(entity === 'hero' ? { hero_target: heroTarget } : {}),
              });
              if (res.ok) {
                setNotice(`Featured ${entity} placed — it is live now.`);
                setRef('');
                router.refresh();
              } else {
                setError(res.error);
              }
            });
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
          Comp slot
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  rows,
  emptyHint,
}: {
  icon: typeof Sparkles;
  title: string;
  rows: MerchRow[];
  emptyHint: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Icon className="text-primary h-4 w-4" />
        <h2 className="text-lg font-semibold">
          {title} ({rows.length})
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted rounded-card border-border border border-dashed p-6 text-center text-sm">
          {emptyHint}
        </p>
      ) : (
        rows.map((r) => <Row key={r.id} r={r} />)
      )}
    </section>
  );
}

export function MerchDesk({ rows, regions }: { rows: MerchRow[]; regions: RegionOption[] }) {
  const pending = rows.filter((r) => r.status === 'pending');
  const liveHero = rows.filter((r) => r.status === 'active' && r.slotType === 'hero');
  const liveBrands = rows.filter((r) => r.status === 'active' && r.slotType === 'brand');
  const liveProducts = rows.filter((r) => r.status === 'active' && r.slotType === 'product');

  return (
    <div className="space-y-8">
      <CompForm regions={regions} />

      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Gift className="text-primary h-4 w-4" />
            <h2 className="text-lg font-semibold">Reservation requests ({pending.length})</h2>
          </div>
          <p className="text-muted text-sm">
            Self-serve reservations awaiting review. Activate to go live nationwide, or Reject to
            free the slot. To run one in a specific metro instead, Reject it and comp the target
            into that region above.
          </p>
          {pending.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </section>
      )}

      <Section
        icon={Images}
        title="Homepage hero live"
        rows={liveHero}
        emptyHint="No hero slots live. Comp a hero above to feature a shop or brand on the homepage carousel."
      />
      <Section
        icon={Sparkles}
        title="Featured brands live"
        rows={liveBrands}
        emptyHint="No featured brand slots live. Comp one above to merchandise a brand in a region."
      />
      <Section
        icon={Package}
        title="Featured products live"
        rows={liveProducts}
        emptyHint="No featured product slots live. Comp one above to merchandise a product in a region."
      />
    </div>
  );
}
