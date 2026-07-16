import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MenuSyncForm } from '@/components/dashboard/menu-sync-form';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { getOwnerFeature } from '@/lib/features';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Menu sync' };

export default async function MenuSyncPage() {
  const { dispensary } = await requireOwnerDispensary();

  if (!(await getOwnerFeature('bulk_import'))) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link
          href="/dashboard/products"
          className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Products
        </Link>
        <h1 className="text-2xl font-bold">Menu sync</h1>
        <UpgradeWall
          feature="Store & POS sync"
          tier="basic"
          description="Upgrade to Basic to keep your menu in step with your existing store or POS automatically. Adding products by hand is always free."
        />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: source } = await supabase
    .from('menu_sources')
    .select('provider,feed_url,auto_sync,status,last_synced_at,last_error,items_imported')
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href="/dashboard/products"
        className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>
      <h1 className="text-2xl font-bold">Menu sync</h1>
      <p className="text-muted text-sm">
        Connect your POS menu export and Weedtip keeps your menu in step automatically —
        no more re-typing products. Point us at a hosted JSON or CSV feed; we import new
        items, update prices, and mark items that leave the feed as out of stock.
      </p>

      <MenuSyncForm
        source={
          source
            ? {
                provider: source.provider,
                feedUrl: source.feed_url,
                autoSync: source.auto_sync,
                status: source.status,
                lastSyncedAt: source.last_synced_at,
                lastError: source.last_error,
                itemsImported: source.items_imported,
              }
            : null
        }
      />

      <section className="card p-5 text-sm">
        <h2 className="font-semibold">Feed format</h2>
        <p className="text-muted mt-1">
          JSON: an array (or <code>{'{ "items": [...] }'}</code>) of objects with{' '}
          <code>name</code>, <code>category</code> (slug or name), and <code>price</code>{' '}
          (dollars) or <code>price_cents</code>. Optional: <code>external_id</code> (your POS
          item id — strongly recommended), <code>brand</code>, <code>strain_type</code>{' '}
          (indica/sativa/hybrid/cbd), <code>thc</code>, <code>cbd</code>, <code>unit</code>,{' '}
          <code>description</code>, <code>image_url</code>, <code>in_stock</code>.
        </p>
        <p className="text-muted mt-2">
          CSV: the same fields as a header row — identical to the{' '}
          <Link href="/dashboard/products/import" className="text-primary hover:underline">
            paste-CSV importer
          </Link>{' '}
          plus an optional <code>external_id</code> column.
        </p>
      </section>
    </div>
  );
}
