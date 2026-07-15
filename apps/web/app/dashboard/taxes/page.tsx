import type { Metadata } from 'next';
import { TaxManager } from '@/components/dashboard/tax-manager';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { requireOwnerDispensary } from '@/lib/owner';
import { getOwnerFeature } from '@/lib/features';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Taxes' };

export default async function DashboardTaxes() {
  const { dispensary } = await requireOwnerDispensary();
  const isPaid = await getOwnerFeature('taxes');

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="eyebrow mb-1">Checkout</p>
        <h1 className="text-2xl font-bold">Taxes</h1>
        <p className="text-muted mt-1 text-sm">
          Configure the taxes applied to online orders and in-store (POS) sales. When set, these
          replace the estimated state rate for your shop.
        </p>
      </div>

      {isPaid ? (
        <TaxesInner dispensaryId={dispensary.id} />
      ) : (
        <UpgradeWall
          feature="Tax configuration"
          description="Bill exact sales and excise taxes on orders and POS sales instead of an estimated rate. Upgrade to Growth to configure your taxes."
        />
      )}
    </div>
  );
}

async function TaxesInner({ dispensaryId }: { dispensaryId: string }) {
  const supabase = await createClient();
  const [{ data: taxes }, { data: rate }] = await Promise.all([
    supabase
      .from('dispensary_taxes')
      .select('*')
      .eq('dispensary_id', dispensaryId)
      .order('sort_order')
      .order('created_at'),
    supabase.rpc('effective_tax_rate', { p_dispensary_id: dispensaryId }),
  ]);

  const effectivePct = typeof rate === 'number' ? (rate * 100).toFixed(2) : null;

  return (
    <div className="space-y-4">
      {effectivePct && (
        <div className="rounded-card border-border bg-surface-2 border p-3 text-sm">
          Effective checkout tax rate: <span className="font-semibold">{effectivePct}%</span>
        </div>
      )}
      <TaxManager taxes={taxes ?? []} />
    </div>
  );
}
