'use client';

import { useMemo, useState, useTransition } from 'react';
import { Minus, Plus, ScanLine, Search, Trash2 } from 'lucide-react';
import { ringSale, verifyStaffPin } from '@/app/actions/pos';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

type Product = {
  id: string;
  name: string;
  price_cents: number;
  stock_qty: number | null;
  barcode: string | null;
  category: string | null;
};

type Receipt = {
  items: { name: string; qty: number; cents: number }[];
  subtotal: number;
  tax: number;
  total: number;
  method: string;
  operator: string | null;
  at: string;
};

const METHODS = ['cash', 'card', 'debit'] as const;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function RegisterTerminal({
  products,
  hasStaff = false,
  dispensaryName,
  taxRate = 0.15,
}: {
  products: Product[];
  hasStaff?: boolean;
  dispensaryName: string;
  /** The shop's state tax rate — must match what create_pos_order charges. */
  taxRate?: number;
}) {
  const [query, setQuery] = useState('');
  const [ticket, setTicket] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operator, setOperator] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const priceById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const byBarcode = useMemo(
    () => new Map(products.filter((p) => p.barcode).map((p) => [p.barcode as string, p])),
    [products],
  );
  const [scan, setScan] = useState('');
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  function onScan() {
    const code = scan.trim();
    if (!code) return;
    const hit = byBarcode.get(code);
    if (hit) {
      add(hit.id);
      setScanMsg(null);
    } else {
      setScanMsg(`No product for "${code}"`);
    }
    setScan('');
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    return list.slice(0, 60);
  }, [query, products]);

  const lines = Object.entries(ticket).filter(([, q]) => q > 0);
  const subtotal = lines.reduce((s, [id, q]) => s + (priceById.get(id)?.price_cents ?? 0) * q, 0);
  const tax = Math.round(subtotal * taxRate);
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

  function printReceipt(r: Receipt) {
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return;
    const rows = r.items
      .map(
        (it) =>
          `<tr><td>${it.qty}× ${escapeHtml(it.name)}</td><td class="r">${formatPrice(it.cents)}</td></tr>`,
      )
      .join('');
    win.document.write(
      `<html><head><title>Receipt</title><style>
        body{font-family:ui-monospace,monospace;font-size:12px;width:280px;margin:0 auto;padding:12px;color:#111}
        h2{text-align:center;margin:0 0 2px}.muted{color:#666;text-align:center;margin:0}
        table{width:100%;border-collapse:collapse;margin:10px 0}td{padding:2px 0}.r{text-align:right}
        .tot{border-top:1px dashed #999;margin-top:8px;padding-top:6px}
       </style></head><body>
        <h2>${escapeHtml(dispensaryName)}</h2>
        <p class="muted">${r.at}${r.operator ? ` · ${escapeHtml(r.operator)}` : ''}</p>
        <table>${rows}</table>
        <table class="tot">
          <tr><td>Subtotal</td><td class="r">${formatPrice(r.subtotal)}</td></tr>
          <tr><td>Tax</td><td class="r">${formatPrice(r.tax)}</td></tr>
          <tr><td><strong>Total</strong></td><td class="r"><strong>${formatPrice(r.total)}</strong></td></tr>
          <tr><td>Paid (${r.method})</td><td class="r">${formatPrice(r.total)}</td></tr>
        </table>
        <p class="muted">Thank you!</p>
       </body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }

  function complete() {
    setError(null);
    const receipt: Receipt = {
      items: lines.map(([id, q]) => ({
        name: priceById.get(id)?.name ?? '',
        qty: q,
        cents: (priceById.get(id)?.price_cents ?? 0) * q,
      })),
      subtotal,
      tax,
      total,
      method,
      operator: operator?.name ?? null,
      at: new Date().toLocaleString(),
    };
    start(async () => {
      const res = await ringSale(
        lines.map(([product_id, quantity]) => ({ product_id, quantity })),
        method,
        operator?.id ?? null,
      );
      if (res.ok) {
        setDone(receipt);
        setTicket({});
      } else {
        setError(res.error ?? 'Could not complete the sale.');
      }
    });
  }

  function signIn() {
    setPinError(null);
    start(async () => {
      const staff = await verifyStaffPin(pin);
      if (staff) {
        setOperator(staff);
        setPin('');
      } else {
        setPinError('PIN not recognized.');
      }
    });
  }

  // When staff PINs are configured, an operator must sign in before ringing.
  if (hasStaff && !operator) {
    return (
      <div className="card mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
        <p className="font-semibold">Sign in to the register</p>
        <p className="text-muted text-sm">Enter your staff PIN to start a sale.</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && signIn()}
          className="border-border bg-background h-11 w-32 rounded-md border text-center text-lg tracking-[0.4em]"
          placeholder="••••"
        />
        {pinError && <p className="text-danger text-sm">{pinError}</p>}
        <Button disabled={pending || pin.length < 4} onClick={signIn}>
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {operator && (
        <div className="text-muted flex items-center justify-end gap-2 text-sm">
          Cashier: <span className="text-foreground font-medium">{operator.name}</span>
          <button
            onClick={() => setOperator(null)}
            className="text-primary hover:underline"
          >
            Switch
          </button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Catalog */}
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onScan();
          }}
          className="mb-2"
        >
          <div className="relative">
            <ScanLine className="text-primary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="Scan or enter a barcode…"
              aria-label="Scan barcode"
              className="border-border bg-surface focus-visible:border-primary/60 h-10 w-full rounded-full border pl-9 pr-4 text-sm outline-none"
            />
          </div>
          {scanMsg && <p className="text-danger mt-1 text-xs">{scanMsg}</p>}
        </form>
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
          <div className="border-primary/30 bg-primary-muted/40 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <span className="text-primary text-sm">
              Sale complete — {formatPrice(done.total)} charged.
            </span>
            <Button size="sm" variant="outline" onClick={() => printReceipt(done)}>
              Print receipt
            </Button>
          </div>
        )}

        <Button disabled={pending || lines.length === 0} onClick={complete} size="lg">
          {pending ? 'Completing…' : `Complete sale · ${formatPrice(total)}`}
        </Button>
      </div>
      </div>
    </div>
  );
}
