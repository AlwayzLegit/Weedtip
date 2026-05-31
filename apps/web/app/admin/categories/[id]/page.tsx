import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryForm } from '@/components/admin/category-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit category · Admin' };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Edit category</h2>
      <CategoryForm category={category} />
    </div>
  );
}
