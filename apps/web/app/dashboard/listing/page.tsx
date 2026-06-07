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
      {dispensary &&
        (dispensary.legal_name ||
          dispensary.license_number ||
          dispensary.dcc_phone ||
          dispensary.dcc_email ||
          dispensary.county) && (
          <div className="rounded-card border-border bg-surface border p-4 text-sm">
            <p className="font-medium">License on file (California DCC)</p>
            <p className="text-muted mt-0.5 text-xs">
              From your state cannabis license — the registered entity and licensee/registered-agent
              contact. These are for reference and verification; your public storefront name, phone,
              and hours are what you edit below.
            </p>
            <dl className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {dispensary.legal_name && (
                <div>
                  <dt className="text-muted inline">Legal name: </dt>
                  <dd className="inline font-medium">{dispensary.legal_name}</dd>
                </div>
              )}
              {dispensary.license_number && (
                <div>
                  <dt className="text-muted inline">License #: </dt>
                  <dd className="inline font-medium">{dispensary.license_number}</dd>
                </div>
              )}
              {dispensary.county && (
                <div>
                  <dt className="text-muted inline">County: </dt>
                  <dd className="inline font-medium">{dispensary.county}</dd>
                </div>
              )}
              {dispensary.dcc_phone && (
                <div>
                  <dt className="text-muted inline">DCC phone: </dt>
                  <dd className="inline font-medium">{dispensary.dcc_phone}</dd>
                </div>
              )}
              {dispensary.dcc_email && (
                <div>
                  <dt className="text-muted inline">DCC email: </dt>
                  <dd className="inline font-medium">{dispensary.dcc_email}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      <ListingForm dispensary={dispensary} />
    </div>
  );
}
