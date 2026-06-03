import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Users · Admin' };

const ROLE_TONE: Record<string, 'primary' | 'default' | 'muted'> = {
  admin: 'primary',
  dispensary_owner: 'default',
  consumer: 'muted',
};

export default async function AdminUsers() {
  const supabase = await createClient();
  // profiles RLS allows admins to read all rows. (Email lives in auth.users and
  // is not exposed via the data API — display name + role shown here.)
  const { data: users } = await supabase
    .from('profiles')
    .select('id,display_name,role,created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Users</h2>
      <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(users ?? []).map((u) => (
              <tr key={u.id} className="bg-surface hover:bg-surface-2/50 transition-colors">
                <td className="px-4 py-3 font-medium">{u.display_name ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={ROLE_TONE[u.role] ?? 'default'}>{u.role.replace('_', ' ')}</Badge>
                </td>
                <td className="text-muted hidden px-4 py-3 sm:table-cell">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
