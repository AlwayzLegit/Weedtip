import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ImportProductsForm } from '@/components/dashboard/import-products-form';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { getOwnerFeature } from '@/lib/features';

export const metadata: Metadata = { title: 'Import products' };

export default async function ImportProductsPage() {
  const entitled = await getOwnerFeature('bulk_import');

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href="/dashboard/products"
        className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>
      <h1 className="text-2xl font-bold">Import products</h1>
      {!entitled ? (
        <UpgradeWall
          feature="CSV import"
          tier="basic"
          description="Upgrade to Basic to bulk-import your menu from a CSV or sync it from your existing store. Adding products by hand is always free."
        />
      ) : (
      <>
      <p className="text-muted text-sm">
        Paste CSV with a header row. Required columns: <code>name</code>, <code>category</code>{' '}
        (slug or name), and <code>price</code> (dollars). Optional: <code>brand</code>,{' '}
        <code>strain_type</code> (indica/sativa/hybrid/cbd), <code>thc</code>, <code>cbd</code>,{' '}
        <code>unit</code>, <code>description</code>, <code>in_stock</code>. Rows upsert by name, so
        re-importing updates existing products.
      </p>
      <ImportProductsForm />
      </>
      )}
    </div>
  );
}
