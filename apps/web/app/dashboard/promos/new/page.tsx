import type { Metadata } from 'next';
import { PromoForm } from '@/components/dashboard/promo-form';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { requireOwnerDispensary } from '@/lib/owner';
import { getOwnerFeature } from '@/lib/features';

export const metadata: Metadata = { title: 'Add in-store promo' };

export default async function NewPromoPage() {
  await requireOwnerDispensary();
  const isPaid = await getOwnerFeature('promos');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add in-store promo</h1>
      {isPaid ? (
        <PromoForm promo={null} />
      ) : (
        <UpgradeWall
          feature="In-store promos"
          description="Highlight in-store-only offers on your storefront. Upgrade to Growth to publish promos — your listing stays free at 0% commission."
        />
      )}
    </div>
  );
}
