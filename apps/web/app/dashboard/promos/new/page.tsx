import type { Metadata } from 'next';
import { PromoForm } from '@/components/dashboard/promo-form';
import { requireOwnerDispensary } from '@/lib/owner';

export const metadata: Metadata = { title: 'Add in-store promo' };

export default async function NewPromoPage() {
  await requireOwnerDispensary();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add in-store promo</h1>
      <PromoForm promo={null} />
    </div>
  );
}
