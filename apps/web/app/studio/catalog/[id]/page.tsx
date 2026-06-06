import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BrandCatalogForm } from '@/components/dashboard/brand-catalog-form';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit catalog product · Studio' };

export default async function EditCatalogProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { brands } = await getBrandOwnerContext();
  const ownedIds = new Set(brands.map((b) => b.id));

  const supabase = await createClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from('brand_products').select('*').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id,name').order('name'),
  ]);
  if (!product) notFound();
  if (!ownedIds.has(product.brand_id)) redirect('/studio/catalog');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit catalog product</h1>
      <div className="card p-6">
        <BrandCatalogForm brandId={product.brand_id} categories={categories ?? []} product={product} />
      </div>
    </div>
  );
}
