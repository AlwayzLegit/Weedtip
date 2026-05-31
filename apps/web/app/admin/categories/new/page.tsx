import type { Metadata } from 'next';
import { CategoryForm } from '@/components/admin/category-form';

export const metadata: Metadata = { title: 'Add category · Admin' };

export default function NewCategoryPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Add category</h2>
      <CategoryForm category={null} />
    </div>
  );
}
