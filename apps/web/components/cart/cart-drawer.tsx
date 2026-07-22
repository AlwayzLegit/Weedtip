'use client';

import { Link } from 'next-view-transitions';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import { formatPrice } from '@/lib/format';
import { Button } from '../ui/button';
import { useCart } from './cart-provider';

/**
 * Weedmaps-style "added to bag" slide-out. Opens automatically on add-to-cart
 * (see CartProvider). Framed as reserve-for-pickup, not checkout — Weedtip
 * never collects payment (pay at the store / to the delivery partner).
 */
export function CartDrawer() {
  const { cart, subtotalCents, count, drawerOpen, closeDrawer, setQuantity, removeItem, orderingEnabled } =
    useCart();

  // Close on Escape, and lock body scroll while open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen, closeDrawer]);

  // Marketing-only mode: the bag drawer never opens (adds are disabled too).
  if (!orderingEnabled || !drawerOpen) return null;

  const empty = !cart || cart.items.length === 0;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Your bag">
      <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} aria-hidden />
      <aside className="bg-background absolute right-0 top-0 flex h-full w-full max-w-sm flex-col shadow-2xl">
        <header className="border-border flex items-center justify-between gap-2 border-b p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <ShoppingBag className="text-primary h-4 w-4" /> Added to bag
            </p>
            {cart && <p className="text-muted truncate text-xs">from {cart.dispensaryName}</p>}
          </div>
          <button
            onClick={closeDrawer}
            aria-label="Close"
            className="text-muted hover:text-foreground rounded-full p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {empty ? (
          <div className="text-muted flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm">
            <ShoppingBag className="h-8 w-8" />
            Your bag is empty.
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {cart!.items.map((it) => (
                <div key={it.productId} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="text-muted text-xs">{formatPrice(it.priceCents)} each</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <button
                        onClick={() => setQuantity(it.productId, it.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="border-border hover:border-primary/50 flex h-6 w-6 items-center justify-center rounded border"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{it.quantity}</span>
                      <button
                        onClick={() => setQuantity(it.productId, it.quantity + 1)}
                        aria-label="Increase quantity"
                        className="border-border hover:border-primary/50 flex h-6 w-6 items-center justify-center rounded border"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(it.productId)}
                        aria-label="Remove item"
                        className="text-muted hover:text-danger ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPrice(it.priceCents * it.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <footer className="border-border space-y-3 border-t p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  Subtotal · {count} item{count === 1 ? '' : 's'}
                </span>
                <span className="font-semibold">{formatPrice(subtotalCents)}</span>
              </div>
              <p className="text-muted text-xs">
                Reserve now and pay at the store (or your delivery driver) — Weedtip never charges
                you.
              </p>
              <Link href="/cart" onClick={closeDrawer} className="block">
                <Button size="lg" className="w-full">
                  View bag &amp; reserve
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="w-full" onClick={closeDrawer}>
                Keep shopping
              </Button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
