import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminDispensaryForm } from '@/components/admin/admin-dispensary-form';
import { AdminDangerZone } from '@/components/admin/admin-danger-zone';
import { AdminFeaturePanel } from '@/components/admin/admin-feature-panel';
import { AdminMenuSeed } from '@/components/admin/admin-menu-seed';
import { Badge } from '@/components/ui/badge';
import { getFeatureStates } from '@/lib/features';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit dispensary · Admin' };

export default async function AdminDispensaryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase.from('dispensaries').select('*').eq('id', id).maybeSingle();
  if (!d) notFound();

  // Likely duplicates: same license number, or same name in the same city.
  const [byLicense, byName, { count: orderCount }] = await Promise.all([
    d.license_number
      ? supabase
          .from('dispensaries')
          .select('id,name,city,state,license_number')
          .eq('license_number', d.license_number)
          .neq('id', d.id)
          .limit(5)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('dispensaries')
      .select('id,name,city,state,license_number')
      .ilike('name', d.name)
      .neq('id', d.id)
      .limit(5),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('dispensary_id', d.id),
  ]);

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('dispensary_id', d.id);
  const dupMap = new Map<
    string,
    { id: string; name: string; city: string | null; state: string; license_number: string | null }
  >();
  for (const row of [...(byLicense.data ?? []), ...(byName.data ?? [])]) dupMap.set(row.id, row);
  const duplicates = [...dupMap.values()];

  // Sub-account: resolved feature states + current plan for the console.
  const [featureStates, { data: sub }] = await Promise.all([
    getFeatureStates(d.id),
    supabase
      .from('dispensary_subscriptions')
      .select('status, plan:plans(name, price_cents)')
      .eq('dispensary_id', d.id)
      .maybeSingle(),
  ]);
  const plan = sub?.plan as { name: string; price_cents: number } | null;
  const planName = plan && sub?.status === 'active' && plan.price_cents > 0 ? plan.name : 'Free';

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/dispensaries" className="text-muted text-sm hover:underline">
          ← Dispensaries
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold">{d.name}</h2>
          <Badge tone={d.status === 'active' ? 'primary' : 'muted'}>{d.status}</Badge>
        </div>
        <p className="text-muted mt-1 text-sm">
          <Link href={`/dispensary/${d.slug}`} className="hover:underline">
            /dispensary/{d.slug}
          </Link>
          {d.owner_id ? ' · claimed' : ' · unclaimed'}
          {` · ${orderCount ?? 0} orders`}
        </p>
      </div>

      <AdminFeaturePanel
        dispensaryId={d.id}
        features={featureStates}
        planName={planName}
        planStatus={sub?.status ?? null}
        posAddon={d.pos_addon}
      />

      <AdminDispensaryForm dispensary={d} />

      <AdminMenuSeed dispensaryId={d.id} productCount={productCount ?? 0} />

      <AdminDangerZone
        dispensaryId={d.id}
        dispensaryName={d.name}
        hasOrders={(orderCount ?? 0) > 0}
        duplicates={duplicates}
      />
    </div>
  );
}
