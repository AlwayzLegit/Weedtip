import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus, Search } from 'lucide-react';
import { deleteStrain } from '@/app/admin/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Strains · Admin' };

export default async function AdminStrains({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = (q ?? '').trim();

  const supabase = await createClient();
  let query = supabase.from('strains').select('id,name,slug,type,effects').order('name');
  if (search) query = query.ilike('name', `%${search}%`);
  const { data: strains } = await query;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Catalog</p>
          <h2 className="text-2xl font-bold">Strains</h2>
        </div>
        <div className="flex items-center gap-2">
          <form className="relative w-44 sm:w-56">
            <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input name="q" defaultValue={search} placeholder="Search strains…" className="pl-9" />
          </form>
          <Link href="/admin/strains/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </Link>
        </div>
      </div>

      <p className="text-muted text-sm">
        {strains?.length ?? 0} {strains?.length === 1 ? 'strain' : 'strains'}
        {search ? ` for “${search}”` : ''}
      </p>

      <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Effects</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(strains ?? []).length === 0 ? (
              <tr className="bg-surface">
                <td colSpan={4} className="text-muted px-4 py-8 text-center">
                  No strains found.
                </td>
              </tr>
            ) : (
              (strains ?? []).map((s) => (
                <tr key={s.id} className="bg-surface hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone="primary">{s.type}</Badge>
                  </td>
                  <td className="text-muted hidden px-4 py-3 sm:table-cell">
                    {s.effects.slice(0, 3).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/strains/${s.id}`}>
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <DeleteButton
                        action={deleteStrain.bind(null, s.id)}
                        confirmText={`Delete "${s.name}"?`}
                      />
                    </div>
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
