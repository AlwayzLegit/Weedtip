import type { Metadata } from 'next';
import { ProductForm } from '@/components/dashboard/product-form';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Add product' };

export default async function NewProductPage() {
  await requireOwnerDispensary();
  const supabase = await createClient();
  const [{ data: categories }, { data: strains }, { data: brands }] = await Promise.all([
    supabase.from('categories').select('id,name').order('sort_order'),
    supabase.from('strains').select('id,name').order('name'),
    supabase.from('brands').select('id,name').order('name'),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add product</h1>
      <ProductForm
        product={null}
        categories={categories ?? []}
        strains={strains ?? []}
        brands={brands ?? []}
      />
    </div>
  );
}
