'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { ESTIMATED_TAX_RATE, type OrderType } from '@weedtip/shared';
import { previewPromo, startCheckout } from '@/app/actions/checkout';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useCart } from './cart-provider';

export function CartView({
  isAuthenticated,
  stripeEnabled = false,
}: {
  isAuthenticated: boolean;
  stripeEnabled?: boolean;
}) {
  const { cart, subtotalCents, setQuantity, removeItem, clear } = useCart();
  const router = useRouter();
  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [payMethod, setPayMethod] = useState<'card' | 'in_person'>(
    stripeEnabled ? 'card' : 'in_person',
  );
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; discountCents: number; title: string } | null>(
    null,
  );
  const [promoPending, setPromoPending] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  if (!cart || cart.items.length === 0) {
    return (
      <div className="rounded-card border-border bg-surface border p-10 text-center">
        <p className="font-medium">Your cart is empty</p>
        <p className="text-muted mt-1 text-sm">Browse dispensaries to start an order.</p>
        <Link href="/dispensaries" className="mt-4 inline-block">
          <Button>Find dispensaries</Button>
        </Link>
      </div>
    );
  }

  const discountCents = promo ? Math.min(promo.discountCents, subtotalCents) : 0;
  const taxCents = Math.round((subtotalCents - discountCents) * ESTIMATED_TAX_RATE);
  const totalCents = subtotalCents - discountCents + taxCents;

  async function applyPromo() {
    if (!cart || !promoInput.trim()) return;
    setPromoPending(true);
    setPromoError(null);
    const res = await previewPromo(cart.dispensaryId, promoInput, subtotalCents);
    if (res.ok) {
      setPromo({ code: promoInput.trim().toUpperCase(), discountCents: res.discountCents, title: res.title });
    } else {
      setPromo(null);
      setPromoError(res.error);
    }
    setPromoPending(false);
  }

  function removePromo() {
    setPromo(null);
    setPromoInput('');
    setPromoError(null);
  }

  async function checkout() {
    if (!cart) return;
    setPending(true);
    setError(null);
    const res = await startCheckout({
      dispensary_id: cart.dispensaryId,
      order_type: orderType,
      notes: notes.trim() || undefined,
      promo_code: promo?.code,
      pay_now: stripeEnabled && payMethod === 'card',
      items: cart.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    });
    if (res.ok && res.mode === 'redirect') {
      clear();
      window.location.href = res.url; // hand off to Stripe Checkout
      return;
    }
    if (res.ok && res.mode === 'order') {
      clear();
      router.push(`/orders/${res.orderId}`);
      return;
    }
    setError(res.error);
    setPending(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <p className="text-muted text-sm">
          Order from{' '}
          <Link
            href={`/dispensary/${cart.dispensarySlug}`}
            className="text-primary hover:underline"
          >
            {cart.dispensaryName}
          </Link>
        </p>
        {cart.items.map((item) => (
          <div
            key={item.productId}
            className="rounded-card border-border bg-surface flex items-center gap-4 border p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-muted text-sm">{formatPrice(item.priceCents)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(item.productId, item.quantity - 1)}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center text-sm">{item.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(item.productId, item.quantity + 1)}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="w-20 text-right font-medium">
              {formatPrice(item.priceCents * item.quantity)}
            </span>
            <button
              onClick={() => removeItem(item.productId)}
              className="text-muted hover:text-danger"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="space-y-4">
        <div className="rounded-card border-border bg-surface border p-5">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatPrice(subtotalCents)}</span>
            </div>
            {discountCents > 0 && promo && (
              <div className="text-primary flex justify-between">
                <span>Discount ({promo.code})</span>
                <span>−{formatPrice(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted">Estimated tax</span>
              <span>{formatPrice(taxCents)}</span>
            </div>
            <div className="border-border flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatPrice(totalCents)}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium">Promo code</p>
            {promo ? (
              <div className="border-primary/40 bg-primary-muted flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="text-primary font-medium">{promo.code} applied</span>
                <button
                  type="button"
                  onClick={removePromo}
                  className="text-muted hover:text-foreground text-xs underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Enter code"
                  className="uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyPromo}
                  disabled={promoPending || !promoInput.trim()}
                >
                  {promoPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Apply
                </Button>
              </div>
            )}
            {promoError && <p className="text-danger mt-1.5 text-xs">{promoError}</p>}
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium">Fulfilment</p>
            <div className="grid grid-cols-2 gap-2">
              {(['pickup', 'delivery'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                    orderType === t
                      ? 'border-primary bg-primary-muted text-primary'
                      : 'border-border text-muted hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {stripeEnabled && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium">Payment</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['card', 'Pay now'],
                    ['in_person', 'At dispensary'],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      payMethod === m
                        ? 'border-primary bg-primary-muted text-primary'
                        : 'border-border text-muted hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any instructions for the dispensary (optional)"
              rows={2}
            />
          </div>

          {error && (
            <p className="border-danger/40 bg-danger/10 text-danger mt-3 rounded-lg border px-3 py-2 text-sm">
              {error}
            </p>
          )}

          {isAuthenticated ? (
            <Button className="mt-4 w-full" size="lg" onClick={checkout} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {stripeEnabled && payMethod === 'card' ? 'Pay' : 'Place order'} ·{' '}
              {formatPrice(totalCents)}
            </Button>
          ) : (
            <Link href="/sign-in?next=/cart" className="mt-4 block">
              <Button className="w-full" size="lg">
                Sign in to check out
              </Button>
            </Link>
          )}
          <p className="text-muted mt-2 text-center text-xs">
            {stripeEnabled && payMethod === 'card'
              ? 'Secure card payment via Stripe. Orders are subject to 21+ ID verification.'
              : 'Payment is collected at the dispensary. Orders are subject to 21+ ID verification.'}
          </p>
        </div>
      </div>
    </div>
  );
}
