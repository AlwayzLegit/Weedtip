import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { deleteStrain } from '@/app/admin/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Strains · Admin' };

export default async function AdminStrains() {
  const supabase = await createClient();
  const { data: strains } = await supabase
    .from('strains')
    .select('id,name,slug,type,effects')
    .order('name');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Strains</h2>
        <Link href="/admin/strains/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add strain
          </Button>
        </Link>
      </div>

      <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Effects</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(strains ?? []).map((s) => (
              <tr key={s.id} className="bg-surface">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
