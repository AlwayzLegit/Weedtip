'use client';

import { useActionState } from 'react';
import { adminSeedMenu } from '@/app/admin/dispensaries/[id]/menu-actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Textarea } from '../ui/textarea';

const SAMPLE = `name,category,price,brand,strain_type,thc,cbd,unit,description,in_stock
OG Kush 3.5g,flower,45,Cookies,hybrid,22.5,0.1,eighth,Earthy classic hybrid,true
Blue Dream Cart 1g,vapes,50,Stiiizy,hybrid,85,0.5,cartridge,Sweet berry vape,true
Wyld Gummies 100mg,edibles,25,Wyld,,,,pack,Real-fruit gummies,true`;

/**
 * Admin menu seeding panel: paste a product CSV to populate any shop's menu —
 * including unclaimed listings the owner-gated import can't reach. Same format
 * as the owner import; rows upsert by (dispensary, slug).
 */
export function AdminMenuSeed({
  dispensaryId,
  productCount,
}: {
  dispensaryId: string;
  productCount: number;
}) {
  const action = adminSeedMenu.bind(null, dispensaryId);
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);

  return (
    <section className="rounded-card border-border bg-surface border p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Seed menu</h3>
        <span className="text-muted text-sm">
          {productCount} product{productCount === 1 ? '' : 's'} on file
        </span>
      </div>
      <p className="text-muted mb-3 text-sm">
        Paste a product CSV to populate this shop&apos;s menu — works on unclaimed listings too.
        Required columns: <code>name</code>, <code>category</code> (slug or name), <code>price</code>{' '}
        (dollars). Optional: <code>brand</code>, <code>strain_type</code>, <code>thc</code>,{' '}
        <code>cbd</code>, <code>unit</code>, <code>description</code>, <code>in_stock</code>. Rows
        upsert by name, so re-seeding updates in place.
      </p>
      <form action={formAction} className="space-y-3">
        <FormMessage
          state={{
            error: state.status === 'error' ? state.message : undefined,
            message: state.status === 'success' ? state.message : undefined,
          }}
        />
        <Textarea name="csv" rows={10} defaultValue={SAMPLE} className="font-mono text-xs" />
        <SubmitButton>Seed products</SubmitButton>
      </form>
    </section>
  );
}
