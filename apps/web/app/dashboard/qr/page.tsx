import type { Metadata } from 'next';
import { QrGenerator } from '@/components/dashboard/qr-generator';
import { requireOwnerDispensary } from '@/lib/owner';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = { title: 'QR codes' };

export default async function DashboardQr() {
  const { dispensary } = await requireOwnerDispensary();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">QR codes</h1>
        <p className="text-muted mt-1 text-sm">
          Generate a printable QR code that links shoppers straight to {dispensary.name} on Weedtip —
          great for counters, flyers, and packaging.
        </p>
      </div>
      <div className="card p-5">
        <QrGenerator baseUrl={SITE_URL} slug={dispensary.slug} name={dispensary.name} />
      </div>
    </div>
  );
}
