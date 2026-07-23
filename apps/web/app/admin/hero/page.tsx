import type { Metadata } from 'next';
import { HeroDesk, type HeroRow } from '@/components/admin/hero-desk';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Hero carousel · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminHero() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('placements')
    .select(
      'id,status,is_active,starts_at,ends_at,price_cents,scope_state,scope_city, dispensary:dispensaries(name,slug), brand:brands(name,slug), creative:ad_creatives(name)',
    )
    .eq('type', 'hero')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows: HeroRow[] = (data ?? []).flatMap((p) => {
    const dispensary = p.dispensary as { name: string; slug: string } | null;
    const brand = p.brand as { name: string; slug: string } | null;
    const target = brand ?? dispensary;
    if (!target) return [];
    return [
      {
        id: p.id,
        status: p.status ?? 'pending',
        isActive: p.is_active,
        startsAt: p.starts_at,
        endsAt: p.ends_at,
        priceCents: p.price_cents ?? 0,
        scopeState: p.scope_state,
        scopeCity: p.scope_city,
        targetKind: brand ? ('brand' as const) : ('dispensary' as const),
        targetName: target.name,
        targetSlug: target.slug,
        creativeName: (p.creative as { name: string } | null)?.name ?? null,
      },
    ];
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Merchandising</p>
        <h2 className="text-2xl font-bold">Homepage hero carousel</h2>
        <p className="text-muted mt-1 text-sm">
          Manage the homepage hero slots — activate sold requests, end them early, or comp a house
          hero to feature a partner. With no live slots, the carousel falls back to organic
          photo-backed dispensaries.
        </p>
      </div>
      <HeroDesk rows={rows} />
    </div>
  );
}
