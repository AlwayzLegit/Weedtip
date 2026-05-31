import type { Metadata } from 'next';
import { ProductForm } from '@/components/dashboard/product-form';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Add product' };

export default async function NewProductPage() {
  await requireOwnerDispensary();
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('id,name')
    .order('sort_order');

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add product</h1>
      <ProductForm product={null} categories={categories ?? []} />
    </div>
  );
}
