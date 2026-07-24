import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { UpdateForm } from '@/components/dashboard/update-form';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { Badge } from '@/components/ui/badge';
import { requireMemberCapability } from '@/lib/owner';
import { getOwnerFeature } from '@/lib/features';
import { createClient } from '@/lib/supabase/server';
import { deleteDispensaryUpdate } from '@/app/actions/updates';

export const metadata: Metadata = { title: 'Updates' };

export default async function DashboardUpdates() {
  const { dispensary } = await requireMemberCapability('marketing');
  const isPaid = await getOwnerFeature('updates');
  const supabase = await createClient();

  const [{ data: updates }, { data: followerCount }] = await Promise.all([
    supabase
      .from('dispensary_updates')
      .select('id,title,body,created_at,expires_at')
      .eq('dispensary_id', dispensary.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('dispensary_follower_count', { p_dispensary_id: dispensary.id }),
  ]);

  const now = Date.now();
  const live = (updates ?? []).filter((u) => new Date(u.expires_at).getTime() > now);
  const past = (updates ?? []).filter((u) => new Date(u.expires_at).getTime() <= now);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Updates</h1>
          <p className="text-muted mt-1 text-sm">
            Broadcast news to people who follow {dispensary.name}. Updates stay live for 6 weeks and
            notify your followers.
          </p>
        </div>
        <div className="text-muted flex items-center gap-1.5 text-sm">
          <Users className="h-4 w-4" />
          {followerCount ?? 0} follower{followerCount === 1 ? '' : 's'}
        </div>
      </div>

      {isPaid ? (
        <div className="card p-5">
          <UpdateForm dispensaryId={dispensary.id} />
        </div>
      ) : (
        <UpgradeWall
          feature="Follower updates"
          description="Broadcast news, drops, and events to everyone who follows your shop. Upgrade to Weedtip Pro to post updates — your listing stays free at 0% commission."
        />
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Live ({live.length})</h2>
        {live.length === 0 ? (
          <p className="text-muted text-sm">No live updates right now.</p>
        ) : (
          <div className="space-y-3">
            {live.map((u) => (
              <div
                key={u.id}
                className="rounded-card border-border bg-surface flex items-start justify-between gap-3 border p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{u.title}</p>
                  {u.body && <p className="text-muted mt-1 text-sm">{u.body}</p>}
                  <p className="text-muted mt-1 text-xs">
                    Posted {new Date(u.created_at).toLocaleDateString()} · expires{' '}
                    {new Date(u.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <DeleteButton
                  action={deleteDispensaryUpdate.bind(null, u.id)}
                  confirmText="Delete this update?"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-muted mb-3 text-lg font-semibold">Past</h2>
          <div className="space-y-3">
            {past.map((u) => (
              <div
                key={u.id}
                className="rounded-card border-border bg-surface flex items-start justify-between gap-3 border p-4 opacity-70"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{u.title}</p>
                    <Badge tone="muted">Expired</Badge>
                  </div>
                  {u.body && <p className="text-muted mt-1 text-sm">{u.body}</p>}
                  <p className="text-muted mt-1 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                <DeleteButton
                  action={deleteDispensaryUpdate.bind(null, u.id)}
                  confirmText="Delete this update?"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
