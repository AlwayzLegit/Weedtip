import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus, Upload } from 'lucide-react';
import { deleteProduct } from '@/app/dashboard/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Products' };

export default async function DashboardProducts() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*, category:categories(name)')
    .eq('dispensary_id', dispensary.id)
    .order('name');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/products/import">
            <Button size="sm" variant="outline">
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
          </Link>
          <Link href="/dashboard/products/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add product
            </Button>
          </Link>
        </div>
      </div>

      {!products || products.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No products yet. Add your first one.
        </div>
      ) : (
        <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Category</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Stock</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {products.map((p) => {
                const category = p.category as { name: string } | null;
                return (
                  <tr key={p.id} className="bg-surface hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.brand && <div className="text-muted text-xs">{p.brand}</div>}
                    </td>
                    <td className="text-muted hidden px-4 py-3 sm:table-cell">
                      {category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">{formatPrice(p.price_cents)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.in_stock ? 'primary' : 'muted'}>
                        {p.in_stock ? 'In stock' : 'Out'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/products/${p.id}`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only sm:not-sr-only">Edit</span>
                          </Button>
                        </Link>
                        <DeleteButton
                          action={deleteProduct.bind(null, p.id)}
                          confirmText={`Delete "${p.name}"?`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
