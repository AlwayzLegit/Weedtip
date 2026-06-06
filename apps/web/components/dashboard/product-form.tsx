'use client';

import { useActionState, useState } from 'react';
import { STRAIN_TYPES } from '@weedtip/shared';
import type { Tables } from '@weedtip/supabase/types';
import { upsertProduct } from '@/app/dashboard/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Checkbox, Field } from './field';
import { ImageUpload } from './image-upload';

const STRAIN_LABELS: Record<string, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export function ProductForm({
  product,
  categories,
  strains,
  brands,
  catalog = [],
}: {
  product: Tables<'products'> | null;
  categories: { id: string; name: string }[];
  strains: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  catalog?: { id: string; name: string; brand_id: string }[];
}) {
  const [state, action] = useActionState(upsertProduct, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const p = product;

  // Catalog linking depends on the selected brand; reset the link when it changes.
  const [brandId, setBrandId] = useState(p?.brand_id ?? '');
  const [catalogId, setCatalogId] = useState(p?.catalog_id ?? '');
  const brandCatalog = catalog.filter((c) => c.brand_id === brandId);

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      {p && <input type="hidden" name="id" value={p.id} />}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category_id" error={fe.category_id}>
          <Select id="category_id" name="category_id" defaultValue={p?.category_id ?? ''} required>
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Strain type" htmlFor="strain_type" error={fe.strain_type}>
          <Select id="strain_type" name="strain_type" defaultValue={p?.strain_type ?? ''}>
            <option value="">None / N/A</option>
            {STRAIN_TYPES.map((s) => (
              <option key={s} value={s}>
                {STRAIN_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={p?.name ?? ''} required />
        </Field>
        <Field label="URL slug" htmlFor="slug" error={fe.slug} hint="Blank = auto from name">
          <Input id="slug" name="slug" defaultValue={p?.slug ?? ''} />
        </Field>
        <Field label="Brand" htmlFor="brand" error={fe.brand}>
          <Input id="brand" name="brand" defaultValue={p?.brand ?? ''} />
        </Field>
        <Field label="Price (USD)" htmlFor="price" error={fe.price_cents}>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={p ? (p.price_cents / 100).toFixed(2) : ''}
            required
          />
        </Field>
      </section>

      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={p?.description ?? ''}
          rows={3}
        />
      </Field>

      <Field
        label="Strain (library)"
        htmlFor="strain_id"
        error={fe.strain_id}
        hint="Link to a strain so it shows on the strain page."
      >
        <Select id="strain_id" name="strain_id" defaultValue={p?.strain_id ?? ''}>
          <option value="">None</option>
          {strains.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Brand (directory)"
        htmlFor="brand_id"
        error={fe.brand_id}
        hint="Link to a brand page."
      >
        <Select
          id="brand_id"
          name="brand_id"
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setCatalogId('');
          }}
        >
          <option value="">None</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>

      {brandId && brandCatalog.length > 0 && (
        <Field
          label="Catalog entry"
          htmlFor="catalog_id"
          hint="Link to this brand's catalog product to inherit its image & description."
        >
          <Select
            id="catalog_id"
            name="catalog_id"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
          >
            <option value="">Not linked</option>
            {brandCatalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
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
        <Field label="Weight (g)" htmlFor="weight_grams" error={fe.weight_grams}>
          <Input
            id="weight_grams"
            name="weight_grams"
            type="number"
            step="0.001"
            min="0"
            defaultValue={p?.weight_grams ?? ''}
          />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit" htmlFor="unit" error={fe.unit} hint="e.g. 3.5g, each, 1/8 oz">
          <Input id="unit" name="unit" defaultValue={p?.unit ?? ''} />
        </Field>
        <Field
          label="Stock count"
          htmlFor="stock_qty"
          error={fe.stock_qty}
          hint="For the POS register — leave blank if untracked"
        >
          <Input
            id="stock_qty"
            name="stock_qty"
            type="number"
            min="0"
            defaultValue={p?.stock_qty ?? ''}
          />
        </Field>
        <Field label="Barcode / SKU" htmlFor="barcode" error={fe.barcode} hint="For POS scanning">
          <Input id="barcode" name="barcode" defaultValue={p?.barcode ?? ''} />
        </Field>
      </section>

      <ImageUpload
        bucket="product-images"
        name="image_urls"
        label="Product image"
        defaultUrl={p?.image_urls?.[0] ?? null}
      />
      {fe.image_urls && <p className="text-danger text-xs">{fe.image_urls}</p>}

      <div className="flex flex-wrap gap-4">
        <Checkbox name="in_stock" label="In stock" defaultChecked={p?.in_stock ?? true} />
        <Checkbox name="is_featured" label="Featured" defaultChecked={p?.is_featured ?? false} />
      </div>

      <SubmitButton size="lg">{p ? 'Save product' : 'Add product'}</SubmitButton>
    </form>
  );
}
