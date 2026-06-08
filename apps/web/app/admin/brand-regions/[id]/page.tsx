import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrandRegionForm } from '@/components/admin/brand-region-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit brand market · Admin' };

export default async function EditBrandRegion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: region } = await supabase
    .from('brand_ad_regions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!region) notFound();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Edit brand market</h2>
      <BrandRegionForm region={region} />
    </div>
  );
}
