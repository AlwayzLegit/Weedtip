'use client';

import { Link } from 'next-view-transitions';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import {
  deliveryAddressSchema,
  ESTIMATED_TAX_RATE,
  type DeliveryAddress,
  type OrderType,
} from '@weedtip/shared';
import {
  getCheckoutRules,
  previewAutoDiscount,
  previewPromo,
  startCheckout,
  type CheckoutRules,
} from '@/app/actions/checkout';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useCart } from './cart-provider';

const EMPTY_ADDRESS: DeliveryAddress = {
  street: '',
  unit: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
};

export function CartView({
  isAuthenticated,
  savedAddress = null,
}: {
  isAuthenticated: boolean;
  savedAddress?: DeliveryAddress | null;
}) {
  const { cart, subtotalCents, setQuantity, removeItem, clear, orderingEnabled } = useCart();
  const router = useRouter();
  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [address, setAddress] = useState<DeliveryAddress>(savedAddress ?? EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'debit'>('cash');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; discountCents: number; title: string } | null>(
    null,
  );
  const [promoPending, setPromoPending] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [autoDiscount, setAutoDiscount] = useState<{ discountCents: number; title: string } | null>(
    null,
  );
  const [rules, setRules] = useState<CheckoutRules | null>(null);

  // Auto "spend & save" order discount preview (when no promo code is applied).
  const dispensaryId = cart?.dispensaryId;

  // Market rules for this dispensary's state: tax rate, medical-only notice,
  // and whether ordering is allowed (create_order re-enforces all of this).
  useEffect(() => {
    if (!dispensaryId) {
      setRules(null);
      return;
    }
    let cancelled = false;
    getCheckoutRules(dispensaryId).then((r) => {
      if (!cancelled) setRules(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dispensaryId]);
  useEffect(() => {
    if (!dispensaryId || promo || subtotalCents <= 0) {
      setAutoDiscount(null);
      return;
    }
    let cancelled = false;
    const items = (cart?.items ?? []).map((it) => ({
      product_id: it.productId,
      quantity: it.quantity,
    }));
    previewAutoDiscount(dispensaryId, subtotalCents, items).then((res) => {
      if (!cancelled) {
        setAutoDiscount(res.ok ? { discountCents: res.discountCents, title: res.title } : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dispensaryId, promo, subtotalCents, cart]);

  // Marketing-only mode: online ordering is turned off platform-wide. Direct
  // visitors to /cart still land somewhere sensible instead of a checkout form.
  if (!orderingEnabled) {
    return (
      <div className="card p-12 text-center">
        <div className="bg-surface-2 text-muted mx-auto flex h-14 w-14 items-center justify-center rounded-full">
          <ShoppingCart className="h-7 w-7" />
        </div>
        <p className="mt-4 font-medium">Online ordering is currently unavailable</p>
        <p className="text-muted mx-auto mt-1 max-w-md text-sm">
          You can browse menus, prices, and deals, then order directly with the dispensary. Online
          checkout on Weedtip is coming soon.
        </p>
        <Link href="/dispensaries" className="mt-5 inline-block">
          <Button>Find dispensaries</Button>
        </Link>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="bg-surface-2 text-muted mx-auto flex h-14 w-14 items-center justify-center rounded-full">
          <ShoppingCart className="h-7 w-7" />
        </div>
        <p className="mt-4 font-medium">Your cart is empty</p>
        <p className="text-muted mt-1 text-sm">Browse dispensaries to start an order.</p>
        <Link href="/dispensaries" className="mt-5 inline-block">
          <Button>Find dispensaries</Button>
        </Link>
      </div>
    );
  }

  const discountCents = promo
    ? Math.min(promo.discountCents, subtotalCents)
    : autoDiscount
      ? Math.min(autoDiscount.discountCents, subtotalCents)
      : 0;
  const taxRate = rules?.taxRate ?? ESTIMATED_TAX_RATE;
  const taxCents = Math.round((subtotalCents - discountCents) * taxRate);
  const totalCents = subtotalCents - discountCents + taxCents;
  const orderBlocked = rules ? !rules.canOrder : false;

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
    // Delivery orders need a valid address before we bother the server.
    let parsedAddress: DeliveryAddress | undefined;
    if (orderType === 'delivery') {
      const check = deliveryAddressSchema.safeParse({
        ...address,
        unit: address.unit?.trim() ? address.unit : undefined,
      });
      if (!check.success) {
        setAddressError(check.error.errors[0]?.message ?? 'Check the delivery address.');
        return;
      }
      parsedAddress = check.data;
      setAddressError(null);
    }
    setPending(true);
    setError(null);
    track('checkout_started', {
      dispensary_id: cart.dispensaryId,
      dispensary_slug: cart.dispensarySlug,
      order_type: orderType,
      item_count: cart.items.length,
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
    });
    const res = await startCheckout({
      dispensary_id: cart.dispensaryId,
      order_type: orderType,
      notes: notes.trim() || undefined,
      promo_code: promo?.code,
      payment_method: payMethod,
      delivery_address: parsedAddress,
      save_address: orderType === 'delivery' ? saveAddress : undefined,
      items: cart.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    });
    if (res.ok) {
      track('order_placed', {
        dispensary_id: cart.dispensaryId,
        dispensary_slug: cart.dispensarySlug,
        order_type: orderType,
        item_count: cart.items.length,
        subtotal_cents: subtotalCents,
        discount_cents: discountCents,
        total_cents: totalCents,
      });
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
            className="rounded-card border-border bg-surface shadow-card flex items-center gap-4 border p-4"
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
        <div className="card sheen p-5 lg:sticky lg:top-20">
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
            {discountCents > 0 && !promo && autoDiscount && (
              <div className="text-primary flex justify-between">
                <span>{autoDiscount.title}</span>
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

          {orderType === 'delivery' && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium">Delivery address</p>
              <div className="space-y-2">
                <Input
                  value={address.street}
                  onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
                  placeholder="Street address"
                  autoComplete="street-address"
                  aria-label="Street address"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={address.unit ?? ''}
                    onChange={(e) => setAddress((a) => ({ ...a, unit: e.target.value }))}
                    placeholder="Unit (opt.)"
                    aria-label="Unit or apartment"
                  />
                  <Input
                    value={address.city}
                    onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    placeholder="City"
                    autoComplete="address-level2"
                    aria-label="City"
                    className="col-span-2"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={address.state}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, state: e.target.value.toUpperCase() }))
                    }
                    placeholder="ST"
                    maxLength={2}
                    autoComplete="address-level1"
                    aria-label="State"
                  />
                  <Input
                    value={address.zip}
                    onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
                    placeholder="ZIP"
                    autoComplete="postal-code"
                    aria-label="ZIP code"
                  />
                  <Input
                    value={address.phone}
                    onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))}
                    placeholder="Phone"
                    type="tel"
                    autoComplete="tel"
                    aria-label="Phone number"
                  />
                </div>
                <label className="text-muted flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="accent-primary h-3.5 w-3.5"
                  />
                  Save as my default delivery address
                </label>
              </div>
              {addressError && <p className="text-danger mt-1.5 text-xs">{addressError}</p>}
            </div>
          )}

          {/* Weedtip never collects payment: the shopper just tells the store
              how they'll pay (industry-standard pay-at-pickup/driver model —
              several states prohibit online cannabis prepay entirely). */}
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium">
              How will you pay {orderType === 'delivery' ? 'your driver' : 'at the store'}?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['cash', 'Cash'],
                  ['debit', 'Debit card'],
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
            <p className="text-muted mt-1.5 text-xs">
              {orderType === 'delivery'
                ? 'Paid to the dispensary’s delivery partner on arrival. Accepted methods vary by store.'
                : 'Paid at the counter when you pick up. Accepted methods vary by store.'}
            </p>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any instructions for the dispensary (optional)"
              rows={2}
            />
          </div>

          {rules?.medicalOnly && !orderBlocked && (
            <p className="border-border bg-surface-2 text-muted mt-3 rounded-lg border px-3 py-2 text-xs">
              {rules.state} licenses medical sales only — a valid medical card is required at{' '}
              {orderType === 'delivery' ? 'delivery' : 'pickup'}.
            </p>
          )}

          {orderBlocked && (
            <p className="border-danger/40 bg-danger/10 text-danger mt-3 rounded-lg border px-3 py-2 text-sm">
              {rules?.blockReason ?? 'Online ordering is unavailable for this dispensary.'}
            </p>
          )}

          {error && (
            <p className="border-danger/40 bg-danger/10 text-danger mt-3 rounded-lg border px-3 py-2 text-sm">
              {error}
            </p>
          )}

          {isAuthenticated ? (
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={checkout}
              disabled={pending || orderBlocked}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Place order · {formatPrice(totalCents)}
            </Button>
          ) : (
            <Link href="/sign-in?next=/cart" className="mt-4 block">
              <Button className="w-full" size="lg">
                Sign in to check out
              </Button>
            </Link>
          )}
          <p className="text-muted mt-2 text-center text-xs">
            Weedtip never charges you — payment is collected{' '}
            {orderType === 'delivery' ? 'by the delivery driver' : 'at the dispensary'}. Orders are
            subject to 21+ ID verification.
          </p>
        </div>
      </div>
    </div>
  );
}
