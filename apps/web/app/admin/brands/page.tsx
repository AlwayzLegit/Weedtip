import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { deleteBrand } from '@/app/admin/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brands · Admin' };

export default async function AdminBrands() {
  const supabase = await createClient();
  const { data: brands } = await supabase.from('brands').select('id,name,slug').order('name');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Brands</h2>
        <Link href="/admin/brands/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add brand
          </Button>
        </Link>
      </div>

      <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Slug</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(brands ?? []).map((b) => (
              <tr key={b.id} className="bg-surface">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="text-muted px-4 py-3">{b.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/admin/brands/${b.id}`}>
                      <Button variant="ghost" size="sm">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DeleteButton
                      action={deleteBrand.bind(null, b.id)}
                      confirmText={`Delete "${b.name}"?`}
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
