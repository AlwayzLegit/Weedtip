import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DealForm } from '@/components/dashboard/deal-form';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit deal' };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();

  if (!deal) notFound();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Edit deal</h1>
      <DealForm deal={deal} />
    </div>
  );
}
