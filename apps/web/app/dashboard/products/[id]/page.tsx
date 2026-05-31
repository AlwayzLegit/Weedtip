import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/dashboard/product-form';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const [{ data: product }, { data: categories }, { data: strains }, { data: brands }] =
    await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('dispensary_id', dispensary.id)
        .maybeSingle(),
      supabase.from('categories').select('id,name').order('sort_order'),
      supabase.from('strains').select('id,name').order('name'),
      supabase.from('brands').select('id,name').order('name'),
    ]);

  if (!product) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit product</h1>
      <ProductForm
        product={product}
        categories={categories ?? []}
        strains={strains ?? []}
        brands={brands ?? []}
      />
    </div>
  );
}
