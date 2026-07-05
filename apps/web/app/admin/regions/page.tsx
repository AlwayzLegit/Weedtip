import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { deleteRegion } from '@/app/admin/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Regions · Admin' };

export default async function AdminRegions() {
  const supabase = await createClient();
  const { data: regions } = await supabase.from('operating_regions').select('*').order('state');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Operating regions</h2>
        <Link href="/admin/regions/new">
          <Button size="sm">Add region</Button>
        </Link>
      </div>
      <p className="text-muted text-xs">
        Legality data drives compliance gating. Verify against current law before relying on it.
      </p>

      <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-4 py-2 font-medium">State</th>
              <th className="px-4 py-2 font-medium">Legality</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Min age</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Tax</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(regions ?? []).map((r) => (
              <tr key={r.state} className="bg-surface">
                <td className="px-4 py-3 font-medium">{r.state}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {r.is_recreational_legal && <Badge tone="primary">Rec</Badge>}
                    {r.is_medical_legal && <Badge tone="outline">Medical</Badge>}
                    {!r.is_recreational_legal && !r.is_medical_legal && (
                      <Badge tone="muted">Illegal</Badge>
                    )}
                  </div>
                </td>
                <td className="text-muted hidden px-4 py-3 sm:table-cell">{r.min_age}</td>
                <td className="text-muted hidden px-4 py-3 sm:table-cell">
                  {(Math.round(r.tax_rate * 10000) / 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/admin/regions/${r.state}`}>
                      <Button variant="ghost" size="sm">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DeleteButton
                      action={deleteRegion.bind(null, r.state)}
                      confirmText={`Delete the ${r.state} region? This cannot be undone.`}
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
