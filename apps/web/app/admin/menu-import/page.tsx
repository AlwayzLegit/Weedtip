import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, UploadCloud } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { BulkMenuImportForm } from './bulk-form';

export const metadata: Metadata = { title: 'Bulk menu import · Admin' };
export const dynamic = 'force-dynamic';

/**
 * Bulk menu seeding: paste one CSV covering many shops (keyed by license or
 * slug) to populate menus across the directory at once — the scale path on
 * top of the per-shop seed. Populated-coverage stats frame the gap.
 */
export default async function BulkMenuImportPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ count: activeShops }, { data: withProducts }] = await Promise.all([
    supabase
      .from('dispensaries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('products').select('dispensary_id'),
  ]);
  const shopsWithMenus = new Set((withProducts ?? []).map((p) => p.dispensary_id)).size;

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href="/admin"
        className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UploadCloud className="text-primary h-6 w-6" /> Bulk menu import
        </h1>
        <p className="text-muted mt-1 text-sm">
          Populate menus across many shops from one CSV. Each row is keyed to a shop by a{' '}
          <code>license</code> (matched to the state license on file) or <code>slug</code> column —
          works on unclaimed listings. Rows upsert by name, so re-importing updates in place.
        </p>
      </div>

      <div className="rounded-card border-border bg-surface-2 flex items-center gap-4 border p-4 text-sm">
        <div>
          <p className="text-2xl font-bold">{shopsWithMenus.toLocaleString()}</p>
          <p className="text-muted text-xs">shops with a menu</p>
        </div>
        <div className="text-muted">of</div>
        <div>
          <p className="text-2xl font-bold">{(activeShops ?? 0).toLocaleString()}</p>
          <p className="text-muted text-xs">active listings</p>
        </div>
        <div className="text-muted ml-auto text-xs">
          {activeShops ? Math.round((shopsWithMenus / activeShops) * 100) : 0}% covered
        </div>
      </div>

      <div className="rounded-card border-border bg-surface border p-5">
        <p className="text-muted mb-3 text-sm">
          Columns: <code>license</code> or <code>slug</code> (shop key), plus <code>name</code>,{' '}
          <code>category</code>, <code>price</code> (required) and optional <code>brand</code>,{' '}
          <code>strain_type</code>, <code>thc</code>, <code>cbd</code>, <code>unit</code>,{' '}
          <code>description</code>, <code>in_stock</code>.
        </p>
        <BulkMenuImportForm />
      </div>
    </div>
  );
}
