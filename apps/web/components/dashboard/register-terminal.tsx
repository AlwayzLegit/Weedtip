'use client';

import { useMemo, useState, useTransition } from 'react';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { ringSale } from '@/app/actions/pos';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

type Product = {
  id: string;
  name: string;
  price_cents: number;
  stock_qty: number | null;
  category: string | null;
};

const TAX_RATE = 0.15;
const METHODS = ['cash', 'card', 'debit'] as const;

export function RegisterTerminal({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [ticket, setTicket] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priceById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    return list.slice(0, 60);
  }, [query, products]);

  const lines = Object.entries(ticket).filter(([, q]) => q > 0);
  const subtotal = lines.reduce((s, [id, q]) => s + (priceById.get(id)?.price_cents ?? 0) * q, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  function add(id: string) {
    setDone(null);
    setError(null);
    setTicket((t) => ({ ...t, [id]: (t[id] ?? 0) + 1 }));
  }
  function setQty(id: string, q: number) {
    setTicket((t) => {
      const next = { ...t };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(99, q);
      return next;
    });
  }

  function complete() {
    setError(null);
    start(async () => {
      const res = await ringSale(
        lines.map(([product_id, quantity]) => ({ product_id, quantity })),
        method,
      );
      if (res.ok) {
        setDone({ total });
        setTicket({});
      } else {
        setError(res.error ?? 'Could not complete the sale.');
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Catalog */}
      <div>
        <div className="relative mb-3">
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="border-border bg-surface h-10 w-full rounded-full border pl-9 pr-4 text-sm outline-none"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="text-muted py-8 text-center text-sm">No matching in-stock products.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                className="rounded-card border-border bg-surface hover:border-primary/50 flex flex-col items-start border p-3 text-left transition-colors"
              >
                <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                <span className="text-primary mt-1 text-sm">{formatPrice(p.price_cents)}</span>
                {p.stock_qty != null && (
                  <span className="text-muted mt-0.5 text-xs">{p.stock_qty} in stock</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ticket */}
      <div className="card flex h-fit flex-col gap-3 p-4">
        <h2 className="font-semibold">Ticket</h2>
        {lines.length === 0 ? (
          <p className="text-muted text-sm">Tap products to add them.</p>
        ) : (
          <div className="divide-border divide-y">
            {lines.map(([id, q]) => {
              const p = priceById.get(id);
              if (!p) return null;
              return (
                <div key={id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-muted text-xs">{formatPrice(p.price_cents)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(id, q - 1)} className="border-border rounded border p-1">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm">{q}</span>
                    <button onClick={() => setQty(id, q + 1)} className="border-border rounded border p-1">
                      <Plus className="h-3 w-3" />
                    </button>
                    <button onClick={() => setQty(id, 0)} className="text-danger ml-1 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-border space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Tax (15%)</span>
            <span>{formatPrice(tax)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={cn(
                'flex-1 rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                method === m
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border text-muted hover:text-foreground',
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}
        {done && (
          <p className="text-primary text-sm">Sale complete — {formatPrice(done.total)} charged.</p>
        )}

        <Button disabled={pending || lines.length === 0} onClick={complete} size="lg">
          {pending ? 'Completing…' : `Complete sale · ${formatPrice(total)}`}
        </Button>
      </div>
    </div>
  );
}
