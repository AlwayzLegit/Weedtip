import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Users · Admin' };

const ROLE_TONE: Record<string, 'primary' | 'default' | 'muted'> = {
  admin: 'primary',
  dispensary_owner: 'default',
  consumer: 'muted',
};
const ROLES = ['admin', 'dispensary_owner', 'consumer'] as const;

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const { role, q } = await searchParams;
  const activeRole = ROLES.includes(role as never) ? role : undefined;
  const search = (q ?? '').trim();

  const supabase = await createClient();
  let query = supabase
    .from('profiles')
    .select('id,display_name,role,created_at')
    .order('created_at', { ascending: false });
  if (activeRole) query = query.eq('role', activeRole as never);
  if (search) query = query.ilike('display_name', `%${search}%`);
  const { data: users } = await query;

  const filters = [{ key: undefined, label: 'All' }, ...ROLES.map((r) => ({ key: r, label: r.replace('_', ' ') }))];
  const pillHref = (key?: string) => {
    const p = new URLSearchParams();
    if (key) p.set('role', key);
    if (search) p.set('q', search);
    const qs = p.toString();
    return `/admin/users${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Manage</p>
          <h2 className="text-2xl font-bold">Users</h2>
        </div>
        <form className="relative w-full sm:w-72">
          {activeRole && <input type="hidden" name="role" value={activeRole} />}
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input name="q" defaultValue={search} placeholder="Search by name…" className="pl-9" />
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={pillHref(f.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              activeRole === f.key
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground',
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <p className="text-muted text-sm">
        {users?.length ?? 0} {users?.length === 1 ? 'user' : 'users'}
        {search ? ` for “${search}”` : ''}
      </p>

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
            {(users ?? []).length === 0 ? (
              <tr className="bg-surface">
                <td colSpan={3} className="text-muted px-4 py-8 text-center">
                  No users found.
                </td>
              </tr>
            ) : (
              (users ?? []).map((u) => (
                <tr key={u.id} className="bg-surface hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.display_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[u.role] ?? 'default'}>{u.role.replace('_', ' ')}</Badge>
                  </td>
                  <td className="text-muted hidden px-4 py-3 sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
