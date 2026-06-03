import type { Metadata } from 'next';
import { DealForm } from '@/components/dashboard/deal-form';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Create deal' };

export default async function NewDealPage() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from('categories').select('id,name').order('sort_order'),
    supabase.from('products').select('id,name').eq('dispensary_id', dispensary.id).order('name'),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Create deal</h1>
      <DealForm deal={null} categories={categories ?? []} products={products ?? []} />
    </div>
  );
}
