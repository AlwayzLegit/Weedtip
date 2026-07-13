'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { requestBrandBid } from '@/app/actions/billing';
import { track } from '@/lib/analytics';
import { cancelBrandBid } from '@/app/actions/brand-bids';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';

type Row = {
  region_id: string;
  region_name: string;
  state: string;
  slots: number;
  floor_cents: number;
  min_winning_cents: number;
  your_bid_cents: number | null;
  your_bid_id: string | null;
  contract_end: string | null;
  is_winning: boolean;
};

export function BrandBidRow({ brandId, row }: { brandId: string; row: Row }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Suggest the bid needed to take a slot (or hold the current one).
  const suggested = Math.max(row.floor_cents, row.your_bid_cents ?? row.min_winning_cents) / 100;
  const [amount, setAmount] = useState(String(suggested));

  const committedUntil = row.contract_end ? new Date(row.contract_end) : null;
  const stillCommitted = committedUntil ? committedUntil.getTime() > Date.now() : false;
  // A paid bid whose 2-month term has lapsed no longer competes (server-enforced).
  const termEnded = row.your_bid_cents != null && committedUntil != null && !stillCommitted;

  // Bids are sales-led: this creates a PENDING bid and the Weedtip team
  // activates it once billing for the 2-month term is arranged.
  function placeBid() {
    const cents = Math.round((Number(amount) || 0) * 100);
    setError(null);
    setNotice(null);
    track('brand_bid_requested', { region_id: row.region_id, bid_cents: cents });
    start(async () => {
      const res = await requestBrandBid({
        brand_id: brandId,
        region_id: row.region_id,
        bid_cents: cents,
      });
      if (res.ok) {
        setNotice(res.message);
        router.refresh();
      } else setError(res.error);
    });
  }

  function withdraw(bidId: string) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await cancelBrandBid(bidId);
      if (res.ok) router.refresh();
      else setError(res.error ?? 'Something went wrong.');
    });
  }

  return (
    <div className="rounded-card border-border bg-surface space-y-3 border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{row.region_name}</span>
          <span className="text-muted ml-2 text-xs">
            {row.slots} slot{row.slots === 1 ? '' : 's'} · floor {formatPrice(row.floor_cents)}/term
          </span>
        </div>
        {row.your_bid_cents != null &&
          (termEnded ? (
            <Badge tone="muted">Term ended</Badge>
          ) : row.is_winning ? (
            <Badge tone="primary">Featured · winning</Badge>
          ) : (
            <Badge tone="muted">Outbid</Badge>
          ))}
      </div>

      <p className="text-muted text-sm">
        Current bid to hold a slot:{' '}
        <strong className="text-foreground">{formatPrice(row.min_winning_cents)}</strong>
        {row.your_bid_cents != null && <> · your bid {formatPrice(row.your_bid_cents)}</>}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-muted mb-1 block font-medium">Your bid ($ / 2-month term)</span>
          <input
            type="number"
            min={row.floor_cents / 100}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border-border bg-background h-10 w-36 rounded-md border px-3"
          />
        </label>
        <Button disabled={pending} onClick={placeBid}>
          {row.your_bid_cents != null ? 'Update bid' : 'Place bid'}
        </Button>
        {row.your_bid_id && (
          <Button variant="outline" disabled={pending} onClick={() => withdraw(row.your_bid_id!)}>
            Withdraw
          </Button>
        )}
      </div>

      {row.your_bid_id && stillCommitted && (
        <p className="text-muted text-xs">
          Committed through {committedUntil!.toLocaleDateString()} (2-month minimum).
        </p>
      )}
      {notice && <p className="text-primary text-sm">{notice}</p>}
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
