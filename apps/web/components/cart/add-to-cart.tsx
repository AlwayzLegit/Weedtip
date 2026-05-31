'use client';

import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { useCart, type DispensaryRef } from './cart-provider';

export function AddToCart({
  dispensary,
  product,
}: {
  dispensary: DispensaryRef;
  product: { productId: string; name: string; priceCents: number };
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="w-full"
      onClick={() => {
        addItem(dispensary, product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
    >
      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {added ? 'Added' : 'Add'}
    </Button>
  );
}
