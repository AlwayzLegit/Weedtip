import type { Metadata } from 'next';
import { StrainForm } from '@/components/admin/strain-form';

export const metadata: Metadata = { title: 'Add strain · Admin' };

export default function NewStrainPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Add strain</h2>
      <StrainForm strain={null} />
    </div>
  );
}
