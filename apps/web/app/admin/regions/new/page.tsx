import type { Metadata } from 'next';
import { RegionForm } from '@/components/admin/region-form';

export const metadata: Metadata = { title: 'Add region · Admin' };

export default function NewRegionPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Add region</h2>
      <RegionForm region={null} />
    </div>
  );
}
