'use client';

import { useActionState, useRef } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { STRAIN_TYPES } from '@weedtip/shared';
import { upsertBrandCatalogProduct } from '@/app/actions/brand-catalog';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';
import { Field } from '@/components/dashboard/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_FORM_STATE } from '@/lib/forms';

type Category = Pick<Tables<'categories'>, 'id' | 'name'>;

export function BrandCatalogForm({
  brandId,
  categories,
  product,
}: {
  brandId: string;
  categories: Category[];
  product?: Tables<'brand_products'> | null;
}) {
  const [state, action] = useActionState(upsertBrandCatalogProduct, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const p = product;

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await action(fd);
        if (!p) formRef.current?.reset();
      }}
      className="space-y-4"
    >
      <FormMessage
        state={{
          error: state.status === 'error' ? state.message : undefined,
          message: state.status === 'success' ? state.message : undefined,
        }}
      />
      <input type="hidden" name="brand_id" value={brandId} />
      {p && <input type="hidden" name="id" value={p.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={p?.name ?? ''} required placeholder="Blue Dream 3.5g" />
        </Field>
        <Field label="Category" htmlFor="category_id" error={fe.category_id}>
          <select
            id="category_id"
            name="category_id"
            defaultValue={p?.category_id ?? ''}
            className="border-border bg-background h-10 w-full rounded-md border px-3"
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Strain type" htmlFor="strain_type">
          <select
            id="strain_type"
            name="strain_type"
            defaultValue={p?.strain_type ?? ''}
            className="border-border bg-background h-10 w-full rounded-md border px-3 capitalize"
          >
            <option value="">— None —</option>
            {STRAIN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Image URL" htmlFor="image_url" error={fe.image_url}>
          <Input id="image_url" name="image_url" defaultValue={p?.image_url ?? ''} placeholder="https://" />
        </Field>
        <Field label="THC %" htmlFor="thc_percentage" error={fe.thc_percentage}>
          <Input
            id="thc_percentage"
            name="thc_percentage"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={p?.thc_percentage ?? ''}
          />
        </Field>
        <Field label="CBD %" htmlFor="cbd_percentage" error={fe.cbd_percentage}>
          <Input
            id="cbd_percentage"
            name="cbd_percentage"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={p?.cbd_percentage ?? ''}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} defaultValue={p?.description ?? ''} />
      </Field>
      <input type="hidden" name="sort_order" value={p?.sort_order ?? 0} />

      <SubmitButton>{p ? 'Save product' : 'Add product'}</SubmitButton>
    </form>
  );
}
