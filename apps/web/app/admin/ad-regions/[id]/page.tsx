import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdRegionForm } from '@/components/admin/ad-region-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit ad region · Admin' };

export default async function EditAdRegion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: region } = await supabase.from('ad_regions').select('*').eq('id', id).maybeSingle();
  if (!region) notFound();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Edit ad region</h2>
      <AdRegionForm region={region} />
    </div>
  );
}
