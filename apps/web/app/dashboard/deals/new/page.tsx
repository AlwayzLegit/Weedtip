import type { Metadata } from 'next';
import { DealForm } from '@/components/dashboard/deal-form';
import { requireOwnerDispensary } from '@/lib/owner';

export const metadata: Metadata = { title: 'Create deal' };

export default async function NewDealPage() {
  await requireOwnerDispensary();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Create deal</h1>
      <DealForm deal={null} />
    </div>
  );
}
