import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegionForm } from '@/components/admin/region-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit region · Admin' };

export default async function EditRegionPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const supabase = await createClient();
  const { data: region } = await supabase
    .from('operating_regions')
    .select('*')
    .eq('state', state.toUpperCase())
    .maybeSingle();
  if (!region) notFound();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Edit {region.state}</h2>
      <RegionForm region={region} />
    </div>
  );
}
