import type { Metadata } from 'next';
import { CartView } from '@/components/cart/cart-view';
import { getAuth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Cart' };

export default async function CartPage() {
  const { user } = await getAuth();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Your cart</h1>
      <CartView isAuthenticated={!!user} />
    </main>
  );
}
