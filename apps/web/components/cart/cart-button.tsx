'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from './cart-provider';

export function CartButton() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      className="text-foreground hover:bg-surface-2 relative inline-flex h-10 w-10 items-center justify-center rounded-lg"
      aria-label={`Cart${count > 0 ? `, ${count} items` : ''}`}
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold">
          {count}
        </span>
      )}
    </Link>
  );
}
