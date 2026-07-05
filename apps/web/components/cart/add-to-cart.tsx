'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { track } from '@/lib/analytics';
import { Button } from '../ui/button';
import { useCart, type DispensaryRef } from './cart-provider';

export function AddToCart({
  dispensary,
  product,
  showQuantity = false,
}: {
  dispensary: DispensaryRef;
  product: { productId: string; name: string; priceCents: number };
  /** Render a quantity stepper beside the button (product detail pages). */
  showQuantity?: boolean;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  function add() {
    addItem(dispensary, product, showQuantity ? qty : 1);
    track('add_to_cart', {
      dispensary_id: dispensary.id,
      dispensary_slug: dispensary.slug,
      product_id: product.productId,
      product_name: product.name,
      price_cents: product.priceCents,
      quantity: showQuantity ? qty : 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  const button = (
    <Button
      type="button"
      size={showQuantity ? 'md' : 'sm'}
      variant={showQuantity ? 'primary' : 'outline'}
      className="w-full"
      onClick={add}
    >
      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {added ? 'Added' : showQuantity ? 'Add to bag' : 'Add'}
    </Button>
  );

  if (!showQuantity) return button;

  return (
    <div className="flex items-center gap-3">
      <div className="border-border flex items-center gap-1 rounded-lg border p-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          aria-label="Decrease quantity"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-6 text-center text-sm font-medium" aria-live="polite">
          {qty}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setQty((q) => Math.min(20, q + 1))}
          aria-label="Increase quantity"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1">{button}</div>
    </div>
  );
}
