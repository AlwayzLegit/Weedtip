import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { deleteBrandUpdate } from '@/app/actions/brand-updates';
import { BrandUpdateForm } from '@/components/dashboard/brand-update-form';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { Badge } from '@/components/ui/badge';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { canUseBrandFeature } from '@/lib/brand-plan';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Updates · Studio' };

export default async function StudioUpdates() {
  const { brands } = await getBrandOwnerContext();
  const ids = brands.map((b) => b.id);

  const entitled = (
    await Promise.all(brands.map((b) => canUseBrandFeature(b.id, 'brand_updates')))
  ).some(Boolean);
  if (!entitled) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Updates</h1>
        <UpgradeWall
          feature="Brand updates"
          tier="basic"
          href="/studio"
          description="Upgrade to Basic to broadcast news to your followers. Your brand page stays live for free."
        />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: updates } = await supabase
    .from('brand_updates')
    .select('id,brand_id,title,body,created_at,expires_at')
    .in('brand_id', ids)
    .order('created_at', { ascending: false });

  const counts = await Promise.all(
    ids.map((id) => supabase.rpc('brand_follower_count', { p_brand_id: id })),
  );
  const followerByBrand = new Map(ids.map((id, i) => [id, counts[i]?.data ?? 0] as const));

  const now = Date.now();
  const byBrand = new Map<string, NonNullable<typeof updates>>();
  for (const u of updates ?? []) {
    const list = byBrand.get(u.brand_id) ?? [];
    list.push(u);
    byBrand.set(u.brand_id, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Updates</h1>
        <p className="text-muted mt-1 text-sm">
          Broadcast news to people who follow your brand. Updates stay live for 6 weeks and notify
          your followers.
        </p>
      </div>

      {brands.map((b) => {
        const list = byBrand.get(b.id) ?? [];
        const live = list.filter((u) => new Date(u.expires_at).getTime() > now);
        const past = list.filter((u) => new Date(u.expires_at).getTime() <= now);
        return (
          <section key={b.id} className="card space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{b.name}</h2>
              <div className="text-muted flex items-center gap-1.5 text-sm">
                <Users className="h-4 w-4" />
                {followerByBrand.get(b.id)} follower{followerByBrand.get(b.id) === 1 ? '' : 's'}
              </div>
            </div>

            <BrandUpdateForm brandId={b.id} />

            {live.length > 0 && (
              <div className="border-border space-y-2 border-t pt-4">
                <h3 className="text-muted text-sm font-semibold uppercase tracking-wide">
                  Live ({live.length})
                </h3>
                {live.map((u) => (
                  <UpdateRow key={u.id} u={u} live />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="border-border space-y-2 border-t pt-4">
                <h3 className="text-muted text-sm font-semibold uppercase tracking-wide">
                  Expired ({past.length})
                </h3>
                {past.map((u) => (
                  <UpdateRow key={u.id} u={u} live={false} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function UpdateRow({
  u,
  live,
}: {
  u: { id: string; title: string; body: string | null; created_at: string };
  live: boolean;
}) {
  return (
    <div className="rounded-card border-border bg-surface flex items-start justify-between gap-3 border p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {live && <Badge tone="primary">Live</Badge>}
          <span className="font-medium">{u.title}</span>
        </div>
        {u.body && <p className="text-muted mt-1 text-sm">{u.body}</p>}
        <p className="text-muted mt-1 text-xs">{new Date(u.created_at).toLocaleDateString()}</p>
      </div>
      <DeleteButton action={deleteBrandUpdate.bind(null, u.id)} confirmText="Delete this update?" />
    </div>
  );
}
