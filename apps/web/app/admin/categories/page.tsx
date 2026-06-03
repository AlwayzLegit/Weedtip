import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { deleteCategory } from '@/app/admin/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Categories · Admin' };

export default async function AdminCategories() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from('categories').select('*').order('sort_order');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Categories</h2>
        <Link href="/admin/categories/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add category
          </Button>
        </Link>
      </div>

      <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Slug</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(categories ?? []).map((c) => (
              <tr key={c.id} className="bg-surface">
                <td className="text-muted px-4 py-3">{c.sort_order}</td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="text-muted px-4 py-3">{c.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/admin/categories/${c.id}`}>
                      <Button variant="ghost" size="sm">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DeleteButton
                      action={deleteCategory.bind(null, c.id)}
                      confirmText={`Delete "${c.name}"? (Fails if products use it.)`}
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
