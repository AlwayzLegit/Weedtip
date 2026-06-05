'use client';

import { useState, useTransition } from 'react';
import { closeShift, openShift } from '@/app/actions/pos';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';

type OpenShift = { id: string; opened_at: string; opening_float_cents: number };
type Live = { cash: number; card: number; debit: number; count: number };

export function ShiftBar({ shift, live }: { shift: OpenShift | null; live: Live }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [floatStr, setFloatStr] = useState('');
  const [closing, setClosing] = useState(false);
  const [countStr, setCountStr] = useState('');

  const dollars = (s: string) => Math.round((Number(s) || 0) * 100);

  if (!shift) {
    return (
      <div className="rounded-card border-border bg-surface flex flex-wrap items-end gap-3 border p-4">
        <label className="text-sm">
          <span className="text-muted mb-1 block font-medium">Opening cash float</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={floatStr}
            onChange={(e) => setFloatStr(e.target.value)}
            placeholder="0.00"
            className="border-border bg-background h-10 w-32 rounded-md border px-3"
          />
        </label>
        <Button
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await openShift(dollars(floatStr));
              if (!res.ok) setError(res.error ?? 'Could not open shift.');
            });
          }}
        >
          Open shift
        </Button>
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    );
  }

  const salesTotal = live.cash + live.card + live.debit;
  const expected = shift.opening_float_cents + live.cash;

  return (
    <div className="rounded-card border-primary/40 bg-primary-muted/40 space-y-3 border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <span className="font-semibold">Shift open</span>
          <span className="text-muted">
            {' '}
            · since {new Date(shift.opened_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ·
            float {formatPrice(shift.opening_float_cents)}
          </span>
        </div>
        <div className="text-muted">
          {live.count} sale{live.count === 1 ? '' : 's'} · {formatPrice(salesTotal)} (cash{' '}
          {formatPrice(live.cash)})
        </div>
      </div>

      {!closing ? (
        <Button variant="outline" size="sm" onClick={() => setClosing(true)}>
          Close shift
        </Button>
      ) : (
        <div className="border-border flex flex-wrap items-end gap-3 border-t pt-3">
          <label className="text-sm">
            <span className="text-muted mb-1 block font-medium">Counted cash in drawer</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={countStr}
              onChange={(e) => setCountStr(e.target.value)}
              placeholder="0.00"
              className="border-border bg-background h-10 w-32 rounded-md border px-3"
            />
          </label>
          <span className="text-muted pb-2 text-xs">Expected {formatPrice(expected)}</span>
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await closeShift(shift.id, dollars(countStr));
                if (!res.ok) setError(res.error ?? 'Could not close shift.');
              });
            }}
          >
            Confirm close
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setClosing(false)}>
            Cancel
          </Button>
          {error && <p className="text-danger w-full text-sm">{error}</p>}
        </div>
      )}
    </div>
  );
}
