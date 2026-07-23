'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Loader2 } from 'lucide-react';
import { activatePlacementRequest } from '@/app/admin/billing-actions';
import { compHeroPlacement, endHeroPlacement, rejectHeroPlacement } from '@/app/admin/hero-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';

export type HeroRow = {
  id: string;
  status: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priceCents: number;
  scopeState: string | null;
  scopeCity: string | null;
  targetKind: 'dispensary' | 'brand';
  targetName: string;
  targetSlug: string;
  creativeName: string | null;
};

function isLive(r: HeroRow): boolean {
  const now = Date.now();
  return (
    r.isActive &&
    (!r.startsAt || new Date(r.startsAt).getTime() <= now) &&
    (!r.endsAt || new Date(r.endsAt).getTime() >= now)
  );
}

function scopeLabel(r: HeroRow): string {
  if (r.scopeCity) return `${r.scopeCity}, ${r.scopeState}`;
  if (r.scopeState) return r.scopeState;
  return 'Nationwide';
}

function Row({ r }: { r: HeroRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const live = isLive(r);
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
          <span className="text-muted text-xs font-normal capitalize">· {r.targetKind}</span>
        </p>
        <p className="text-muted mt-0.5 text-xs">
          {scopeLabel(r)}
          {r.priceCents === 0 ? ' · house (comped)' : ` · ${formatPrice(r.priceCents)}`}
          {r.creativeName ? ` · creative: ${r.creativeName}` : ' · logo/cover'}
          {r.endsAt ? ` · until ${new Date(r.endsAt).toLocaleDateString()}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={live ? 'primary' : isPending ? 'outline' : 'muted'}>
          {live ? 'Live' : isPending ? 'Pending' : 'Ended'}
        </Badge>
        {isPending && (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => activatePlacementRequest(r.id))}
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => rejectHeroPlacement(r.id))}
            >
              Reject
            </Button>
          </>
        )}
        {live && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => endHeroPlacement(r.id))}
          >
            End
          </Button>
        )}
      </div>
    </div>
  );
}

function CompForm() {
  const router = useRouter();
  const [target, setTarget] = useState<'dispensary' | 'brand'>('dispensary');
  const [slug, setSlug] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [city, setCity] = useState('');
  const [days, setDays] = useState(30);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const targeted = stateCode.trim().length === 2;

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Gift className="text-primary h-4 w-4" />
        <h2 className="text-lg font-semibold">Comp a house hero</h2>
      </div>
      <p className="text-muted text-sm">
        Place a dispensary or brand into the homepage hero carousel for free — fills the carousel
        with chosen partners while a market ramps up. Goes live immediately.
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
            value={target}
            onChange={(e) => setTarget(e.target.value as 'dispensary' | 'brand')}
            className="border-border bg-background block w-32 rounded-md border px-3 py-2"
          >
            <option value="dispensary">Dispensary</option>
            <option value="brand">Brand</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.trim())}
            placeholder={target === 'dispensary' ? 'green-cross' : 'stiiizy'}
            className="border-border bg-background block w-56 rounded-md border px-3 py-2"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">State</span>
          <input
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
            placeholder="Nation"
            maxLength={2}
            className="border-border bg-background block w-20 rounded-md border px-3 py-2 uppercase"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">City</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value.slice(0, 80))}
            placeholder={targeted ? 'optional' : 'set state'}
            disabled={!targeted}
            className="border-border bg-background block w-36 rounded-md border px-3 py-2 disabled:opacity-50"
          />
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
          disabled={busy || !slug}
          onClick={() => {
            setError(null);
            setNotice(null);
            start(async () => {
              const res = await compHeroPlacement({
                target,
                slug,
                scope_state: targeted ? stateCode.toUpperCase() : undefined,
                scope_city: targeted && city.trim() ? city.trim() : undefined,
                days,
              });
              if (res.ok) {
                setNotice('House hero placed — it is live now.');
                setSlug('');
                setCity('');
                router.refresh();
              } else {
                setError(res.error);
              }
            });
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
          Comp hero
        </Button>
      </div>
    </div>
  );
}

export function HeroDesk({ rows }: { rows: HeroRow[] }) {
  const pending = rows.filter((r) => r.status === 'pending');
  const live = rows.filter((r) => r.status !== 'pending' && isLive(r));
  const ended = rows.filter((r) => r.status !== 'pending' && !isLive(r));

  return (
    <div className="space-y-8">
      <CompForm />

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pending requests ({pending.length})</h2>
          {pending.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Live in the carousel ({live.length})</h2>
        {live.length === 0 ? (
          <p className="text-muted rounded-card border-border border border-dashed p-6 text-center text-sm">
            No paid or comped hero slots live — the homepage carousel is running on organic fill.
            Comp a house hero above to feature specific partners.
          </p>
        ) : (
          live.map((r) => <Row key={r.id} r={r} />)
        )}
      </section>

      {ended.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted text-sm font-semibold uppercase tracking-wide">
            Ended / inactive ({ended.length})
          </h2>
          {ended.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </section>
      )}
    </div>
  );
}
