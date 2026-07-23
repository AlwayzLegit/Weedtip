import type { Metadata } from 'next';
import { MerchDesk, type MerchRow, type RegionOption } from '@/components/admin/merch-desk';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brand & product merchandising · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminMerch() {
  const supabase = await createClient();

  const [{ data: subs }, { data: regions }] = await Promise.all([
    supabase
      .from('ad_subscriptions')
      .select(
        'id,status,starts_at,ends_at,price_paid,is_house,brand_id,product_id,dispensary_id, slot:ad_slots!inner(slot_type,position,region:ad_regions(name,slug)), brand:brands(name,slug), product:products(name), dispensary:dispensaries(name,slug)',
      )
      .eq('status', 'active')
      .in('slot.slot_type', ['brand', 'product'])
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('ad_regions')
      .select('slug,name, market:ad_markets(state)')
      .eq('is_active', true)
      .order('name'),
  ]);

  const rows: MerchRow[] = (subs ?? []).flatMap((s) => {
    const slot = s.slot as {
      slot_type: 'brand' | 'product';
      position: number;
      region: { name: string; slug: string } | null;
    } | null;
    if (!slot || (slot.slot_type !== 'brand' && slot.slot_type !== 'product')) return [];
    const brand = s.brand as { name: string; slug: string } | null;
    const product = s.product as { name: string } | null;
    const dispensary = s.dispensary as { name: string; slug: string } | null;
    const targetName = slot.slot_type === 'brand' ? (brand?.name ?? '—') : (product?.name ?? '—');
    return [
      {
        id: s.id,
        slotType: slot.slot_type,
        position: slot.position,
        regionName: slot.region?.name ?? 'Unknown region',
        targetName,
        advertiserName: brand?.name ?? dispensary?.name ?? null,
        isHouse: s.is_house,
        priceCents: s.price_paid,
        endsAt: s.ends_at,
      },
    ];
  });

  const regionOptions: RegionOption[] = (regions ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    state: (r.market as { state: string } | null)?.state ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Merchandising</p>
        <h2 className="text-2xl font-bold">Featured brands &amp; products</h2>
        <p className="text-muted mt-1 text-sm">
          Comp a brand or product into a region&apos;s featured inventory — the same region ad-slot
          model as dispensary spots and the hero, so every sold spot is managed in one place. Each
          region has a fixed number of brand and product slots; a house comp fills the next open one
          and goes live immediately.
        </p>
      </div>
      <MerchDesk rows={rows} regions={regionOptions} />
    </div>
  );
}
