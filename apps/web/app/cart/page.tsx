import type { Metadata } from 'next';
import type { DeliveryAddress } from '@weedtip/shared';
import { CartView } from '@/components/cart/cart-view';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Cart' };

export default async function CartPage() {
  const { user } = await getAuth();

  // Prefill the delivery form with the shopper's saved default address.
  let savedAddress: DeliveryAddress | null = null;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('delivery_address')
      .eq('id', user.id)
      .maybeSingle();
    savedAddress = (data?.delivery_address as DeliveryAddress | null) ?? null;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Your cart</h1>
      <CartView isAuthenticated={!!user} savedAddress={savedAddress} />
    </main>
  );
}
