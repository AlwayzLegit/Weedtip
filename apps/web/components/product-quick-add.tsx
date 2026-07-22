'use client';

import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { track } from '@/lib/analytics';
import { useCart, type DispensaryRef } from './cart/cart-provider';

/**
 * Compact "+" quick-add that floats on a product card. Rendered as a sibling of
 * the card's Link (never nested inside the anchor), and stops propagation so a
 * tap adds to the bag instead of navigating to the product page.
 */
export function ProductQuickAdd({
  dispensary,
  product,
}: {
  dispensary: DispensaryRef;
  product: { productId: string; name: string; priceCents: number };
}) {
  const { addItem, orderingEnabled } = useCart();
  const [added, setAdded] = useState(false);

  // Marketing-only mode: no quick-add on product cards.
  if (!orderingEnabled) return null;

  return (
    <button
      type="button"
      aria-label={`Add ${product.name} to bag`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addItem(dispensary, product, 1);
        track('add_to_cart', {
          dispensary_id: dispensary.id,
          dispensary_slug: dispensary.slug,
          product_id: product.productId,
          product_name: product.name,
          price_cents: product.priceCents,
          quantity: 1,
          source: 'quick_add',
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/50 absolute right-2 top-28 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2"
    >
      {added ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
    </button>
  );
}
