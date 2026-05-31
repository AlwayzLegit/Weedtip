import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { ListingForm } from '@/components/dashboard/listing-form';
import { getOwnerContext } from '@/lib/owner';

export const metadata: Metadata = { title: 'Listing' };

export default async function ListingPage() {
  const { dispensary } = await getOwnerContext();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">
          {dispensary ? 'Edit listing' : 'Create your listing'}
        </h1>
        {dispensary && (
          <Badge tone={dispensary.status === 'active' ? 'primary' : 'muted'}>
            {dispensary.status}
          </Badge>
        )}
      </div>
      {!dispensary && (
        <p className="text-muted text-sm">
          New listings start as <Badge tone="muted">pending</Badge> and go live once a Weedtip admin
          approves them.
        </p>
      )}
      <ListingForm dispensary={dispensary} />
    </div>
  );
}
