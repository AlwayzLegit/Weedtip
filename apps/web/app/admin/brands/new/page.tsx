import type { Metadata } from 'next';
import { BrandForm } from '@/components/admin/brand-form';

export const metadata: Metadata = { title: 'Add brand · Admin' };

export default function NewBrandPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Add brand</h2>
      <BrandForm brand={null} />
    </div>
  );
}
