import type { Metadata } from 'next';
import { TeamManager } from '@/components/dashboard/team-manager';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { getOwnerFeature } from '@/lib/features';
import { requireDispensaryOwner } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Team' };

/** Owner-only team management. Team members are a Growth feature. */
export default async function DashboardTeam() {
  const { dispensary } = await requireDispensaryOwner();
  const canTeam = await getOwnerFeature('team');

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="eyebrow mb-1">Access</p>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted mt-1 text-sm">
          Invite managers and staff to help run {dispensary.name}. They get access to the menu,
          deals, and orders — billing and team stay with you.
        </p>
      </div>

      {canTeam ? <TeamInner dispensaryId={dispensary.id} /> : (
        <UpgradeWall
          feature="Team members"
          description="Add managers and staff to help run your shop. Upgrade to Growth to invite your team."
        />
      )}
    </div>
  );
}

async function TeamInner({ dispensaryId }: { dispensaryId: string }) {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from('dispensary_members')
    .select('*')
    .eq('dispensary_id', dispensaryId)
    .order('created_at');
  return <TeamManager members={members ?? []} />;
}
