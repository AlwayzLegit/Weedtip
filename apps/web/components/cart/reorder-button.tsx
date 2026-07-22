'use client';

import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { useCart, type DispensaryRef } from './cart-provider';

interface ReorderItem {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
}

/** Re-adds a past order's items to the cart and jumps to checkout. */
export function ReorderButton({
  dispensary,
  items,
}: {
  dispensary: DispensaryRef;
  items: ReorderItem[];
}) {
  const { addItem, orderingEnabled } = useCart();
  const router = useRouter();

  // Marketing-only mode: reordering is an ordering action — hide it.
  if (!orderingEnabled) return null;

  return (
    <Button
      variant="outline"
      onClick={() => {
        items.forEach((i) =>
          addItem(
            dispensary,
            { productId: i.productId, name: i.name, priceCents: i.priceCents },
            i.quantity,
          ),
        );
        router.push('/cart');
      }}
    >
      <RotateCcw className="h-4 w-4" />
      Reorder
    </Button>
  );
}
