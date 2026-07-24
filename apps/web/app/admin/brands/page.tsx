import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus, Search } from 'lucide-react';
import { approveBrand, deleteBrand, rejectBrand } from '@/app/admin/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brands · Admin' };

export default async function AdminBrands({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = (q ?? '').trim();

  const supabase = await createClient();
  let query = supabase.from('brands').select('id,name,slug,status').order('name');
  if (search) query = query.ilike('name', `%${search}%`);
  const [{ data: brands }, { data: pending }] = await Promise.all([
    query,
    supabase
      .from('brands')
      .select('id,name,slug,website,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  return (
    <div className="space-y-4">
      {pending && pending.length > 0 && (
        <div className="rounded-card space-y-3 border border-amber-500/40 bg-amber-500/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            Pending review
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-700">
              {pending.length}
            </span>
          </h3>
          <div className="space-y-2">
            {pending.map((b) => (
              <div
                key={b.id}
                className="rounded-card border-border bg-surface flex flex-wrap items-center justify-between gap-3 border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{b.name}</p>
                  <p className="text-muted text-xs">
                    {b.website ? `${b.website} · ` : ''}
                    submitted {new Date(b.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={approveBrand.bind(null, b.id)}>
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form action={rejectBrand.bind(null, b.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Catalog</p>
          <h2 className="text-2xl font-bold">Brands</h2>
        </div>
        <div className="flex items-center gap-2">
          <form className="relative w-44 sm:w-56">
            <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input name="q" defaultValue={search} placeholder="Search brands…" className="pl-9" />
          </form>
          <Link href="/admin/brands/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </Link>
        </div>
      </div>

      <p className="text-muted text-sm">
        {brands?.length ?? 0} {brands?.length === 1 ? 'brand' : 'brands'}
        {search ? ` for “${search}”` : ''}
      </p>

      <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Slug</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(brands ?? []).length === 0 ? (
              <tr className="bg-surface">
                <td colSpan={3} className="text-muted px-4 py-8 text-center">
                  No brands found.
                </td>
              </tr>
            ) : (
              (brands ?? []).map((b) => (
                <tr key={b.id} className="bg-surface hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {b.name}
                    {b.status !== 'active' && (
                      <span className="text-muted ml-2 text-xs font-normal">({b.status})</span>
                    )}
                  </td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
