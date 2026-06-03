'use client';

import { useActionState, useState } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { upsertDeal } from '@/app/dashboard/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Checkbox, Field } from './field';

type NameRef = { id: string; name: string };

const KINDS = [
  { value: 'percentage', label: 'Percentage off' },
  { value: 'fixed_amount', label: 'Fixed amount off' },
  { value: 'price_target', label: 'Set price to' },
  { value: 'bogo', label: 'Buy one get one' },
] as const;
type Kind = (typeof KINDS)[number]['value'];

const VALUE_HINT: Record<Kind, string> = {
  percentage: 'Percent off (≤100).',
  fixed_amount: 'Dollar amount off each item.',
  price_target: 'New per-item price, in dollars.',
  bogo: 'Not used for BOGO.',
};
const VALUE_LABEL: Record<Kind, string> = {
  percentage: 'Percent off',
  fixed_amount: 'Amount off ($)',
  price_target: 'Sale price ($)',
  bogo: 'Value',
};

const DOW = [
  { v: 0, label: 'Sun' },
  { v: 1, label: 'Mon' },
  { v: 2, label: 'Tue' },
  { v: 3, label: 'Wed' },
  { v: 4, label: 'Thu' },
  { v: 5, label: 'Fri' },
  { v: 6, label: 'Sat' },
];

/** ISO → "YYYY-MM-DDTHH:mm" for datetime-local inputs. */
function toLocalInput(iso: string | undefined): string {
  return iso ? iso.slice(0, 16) : '';
}

export function DealForm({
  deal,
  categories,
  products,
}: {
  deal: Tables<'deals'> | null;
  categories: NameRef[];
  products: NameRef[];
}) {
  const [state, action] = useActionState(upsertDeal, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const d = deal;

  const initialKind = (KINDS.find((k) => k.value === d?.kind)?.value ?? 'percentage') as Kind;
  const [kind, setKind] = useState<Kind>(initialKind);
  const [autoApply, setAutoApply] = useState(d?.auto_apply ?? false);
  const [scope, setScope] = useState(d?.target_scope ?? 'menu');

  const defaultValue =
    kind === 'price_target'
      ? d?.target_price_cents != null
        ? String(d.target_price_cents / 100)
        : ''
      : (d?.discount_value ?? '');

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={{ error: state.status === 'error' ? state.message : undefined }} />
      {d && <input type="hidden" name="id" value={d.id} />}

      <Field label="Title" htmlFor="title" error={fe.title}>
        <Input id="title" name="title" defaultValue={d?.title ?? ''} required />
      </Field>

      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea id="description" name="description" defaultValue={d?.description ?? ''} rows={2} />
      </Field>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Discount" htmlFor="kind" error={fe.kind}>
          <Select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={VALUE_LABEL[kind]}
          htmlFor="discount_value"
          error={fe.discount_value}
          hint={VALUE_HINT[kind]}
        >
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValue}
            disabled={kind === 'bogo'}
          />
        </Field>
      </section>

      {/* Storefront sale: auto-apply targeting + scheduling */}
      <section className="rounded-card border-border space-y-4 border p-4">
        <Checkbox
          name="auto_apply"
          label="Apply automatically as a storefront sale (no promo code needed)"
          defaultChecked={autoApply}
          onChange={(e) => setAutoApply((e.target as HTMLInputElement).checked)}
        />

        {autoApply ? (
          <>
            <Field label="Applies to" htmlFor="target_scope">
              <Select
                id="target_scope"
                name="target_scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
              >
                <option value="menu">Entire menu</option>
                <option value="category">Specific categories</option>
                <option value="products">Specific products</option>
              </Select>
            </Field>

            {scope === 'category' && (
              <Field label="Categories" htmlFor="target_category_ids" hint="Cmd/Ctrl-click to select multiple.">
                <select
                  id="target_category_ids"
                  name="target_category_ids"
                  multiple
                  defaultValue={d?.target_category_ids ?? []}
                  className="border-border bg-background h-32 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {scope === 'products' && (
              <Field label="Products" htmlFor="target_product_ids" hint="Cmd/Ctrl-click to select multiple.">
                <select
                  id="target_product_ids"
                  name="target_product_ids"
                  multiple
                  defaultValue={d?.target_product_ids ?? []}
                  className="border-border bg-background h-40 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Days of week" htmlFor="dow" hint="Leave all unchecked to run every day.">
              <div className="flex flex-wrap gap-3">
                {DOW.map((day) => (
                  <label key={day.v} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name={`dow_${day.v}`}
                      defaultChecked={(d?.days_of_week ?? []).includes(day.v)}
                      className="accent-primary"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </Field>

            <Checkbox
              name="featured"
              label="Highlight as a featured special"
              defaultChecked={d?.featured ?? false}
            />
          </>
        ) : (
          <Field
            label="Promo code"
            htmlFor="code"
            error={fe.code}
            hint="Optional. Customers enter this at checkout to apply the discount (e.g. SAVE20)."
          >
            <Input
              id="code"
              name="code"
              defaultValue={d?.code ?? ''}
              placeholder="SAVE20"
              className="uppercase"
            />
          </Field>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="start_date" error={fe.start_date}>
          <Input
            id="start_date"
            name="start_date"
            type="datetime-local"
            defaultValue={toLocalInput(d?.start_date)}
            required
          />
        </Field>
        <Field label="Ends" htmlFor="end_date" error={fe.end_date}>
          <Input
            id="end_date"
            name="end_date"
            type="datetime-local"
            defaultValue={toLocalInput(d?.end_date)}
            required
          />
        </Field>
      </section>

      <Checkbox name="is_active" label="Active" defaultChecked={d?.is_active ?? true} />

      <SubmitButton size="lg">{d ? 'Save deal' : 'Create deal'}</SubmitButton>
    </form>
  );
}
