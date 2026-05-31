import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrandForm } from '@/components/admin/brand-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit brand · Admin' };

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: brand } = await supabase.from('brands').select('*').eq('id', id).maybeSingle();
  if (!brand) notFound();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Edit brand</h2>
      <BrandForm brand={brand} />
    </div>
  );
}
