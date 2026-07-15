import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PromoForm } from '@/components/dashboard/promo-form';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { requireOwnerDispensary } from '@/lib/owner';
import { getOwnerFeature } from '@/lib/features';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit in-store promo' };

export default async function EditPromoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dispensary } = await requireOwnerDispensary();
  const isPaid = await getOwnerFeature('promos');
  const supabase = await createClient();
  const { data: promo } = await supabase
    .from('dispensary_promos')
    .select('*')
    .eq('id', id)
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();
  if (!promo) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit in-store promo</h1>
      {isPaid ? (
        <PromoForm promo={promo} />
      ) : (
        <UpgradeWall feature="In-store promos" />
      )}
    </div>
  );
}
