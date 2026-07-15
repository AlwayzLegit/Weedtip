import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DealForm } from '@/components/dashboard/deal-form';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { requireOwnerDispensary } from '@/lib/owner';
import { getOwnerFeature } from '@/lib/features';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit deal' };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dispensary } = await requireOwnerDispensary();
  const isPaid = await getOwnerFeature('deals');
  const supabase = await createClient();

  const [{ data: deal }, { data: categories }, { data: products }] = await Promise.all([
    supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .eq('dispensary_id', dispensary.id)
      .maybeSingle(),
    supabase.from('categories').select('id,name').order('sort_order'),
    supabase.from('products').select('id,name').eq('dispensary_id', dispensary.id).order('name'),
  ]);

  if (!deal) notFound();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Edit deal</h1>
      {isPaid ? (
        <DealForm deal={deal} categories={categories ?? []} products={products ?? []} />
      ) : (
        <UpgradeWall
          feature="Deals"
          description="Editing and publishing deals is part of Growth. Upgrade to manage this deal — your listing stays free at 0% commission."
        />
      )}
    </div>
  );
}
