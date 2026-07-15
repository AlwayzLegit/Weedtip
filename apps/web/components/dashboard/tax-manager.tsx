'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Tables } from '@weedtip/supabase/types';
import { deleteTax, upsertTax } from '@/app/dashboard/taxes/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type Tax = Tables<'dispensary_taxes'>;

const TYPE_LABEL = { sales: 'Sales', excise: 'Excise' } as const;
const USE_LABEL = { adult: 'Adult use', medical: 'Medical', both: 'Adult + medical' } as const;

const EMPTY = { id: '', name: '', rate_percent: '', tax_type: 'sales', use_type: 'both', enabled: true };

/** Add/edit/delete a dispensary's taxes; refreshes the server list after each change. */
export function TaxManager({ taxes }: { taxes: Tax[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function edit(t: Tax) {
    setForm({
      id: t.id,
      name: t.name,
      rate_percent: (t.rate_bps / 100).toString(),
      tax_type: t.tax_type,
      use_type: t.use_type,
      enabled: t.enabled,
    });
    setError(null);
  }

  function reset() {
    setForm({ ...EMPTY });
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    if (form.id) fd.set('id', form.id);
    fd.set('name', form.name);
    fd.set('rate_percent', form.rate_percent);
    fd.set('tax_type', form.tax_type);
    fd.set('use_type', form.use_type);
    fd.set('enabled', String(form.enabled));
    start(async () => {
      const res = await upsertTax(EMPTY_FORM_STATE, fd);
      if (res.status === 'error') {
        setError(res.message ?? 'Could not save.');
        return;
      }
      reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteTax(id);
      router.refresh();
    });
  }

  function toggle(t: Tax) {
    const fd = new FormData();
    fd.set('id', t.id);
    fd.set('name', t.name);
    fd.set('rate_percent', (t.rate_bps / 100).toString());
    fd.set('tax_type', t.tax_type);
    fd.set('use_type', t.use_type);
    fd.set('enabled', String(!t.enabled));
    start(async () => {
      await upsertTax(EMPTY_FORM_STATE, fd);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Existing taxes */}
      {taxes.length > 0 ? (
        <div className="rounded-card border-border bg-surface overflow-hidden border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Rate</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Applies to</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {taxes.map((t) => (
                <tr key={t.id} className="bg-surface">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">{(t.rate_bps / 100).toFixed(2)}%</td>
                  <td className="text-muted px-4 py-3">
                    {TYPE_LABEL[t.tax_type as keyof typeof TYPE_LABEL] ?? t.tax_type}
                  </td>
                  <td className="text-muted px-4 py-3">
                    {USE_LABEL[t.use_type as keyof typeof USE_LABEL] ?? t.use_type}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(t)}
                      disabled={pending}
                      className={
                        t.enabled
                          ? 'text-primary text-xs font-semibold'
                          : 'text-muted text-xs font-semibold'
                      }
                    >
                      {t.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => edit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(t.id)} disabled={pending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted text-sm">
          No taxes configured — orders currently use the estimated state rate. Add your taxes below to
          bill exact amounts.
        </p>
      )}

      {/* Add / edit form */}
      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{form.id ? 'Edit tax' : 'Add a tax'}</h2>
          {form.id && (
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <X className="h-4 w-4" /> Cancel edit
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tax-name">Name</Label>
            <Input
              id="tax-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. State excise"
              maxLength={60}
              required
            />
          </div>
          <div>
            <Label htmlFor="tax-rate">Rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.rate_percent}
              onChange={(e) => setForm((f) => ({ ...f, rate_percent: e.target.value }))}
              placeholder="e.g. 15"
              required
            />
          </div>
          <div>
            <Label htmlFor="tax-type">Tax type</Label>
            <select
              id="tax-type"
              value={form.tax_type}
              onChange={(e) => setForm((f) => ({ ...f, tax_type: e.target.value }))}
              className="border-border bg-surface-2 text-foreground h-11 w-full rounded-lg border px-3.5 text-sm"
            >
              <option value="sales">Sales</option>
              <option value="excise">Excise</option>
            </select>
          </div>
          <div>
            <Label htmlFor="tax-use">Applies to</Label>
            <select
              id="tax-use"
              value={form.use_type}
              onChange={(e) => setForm((f) => ({ ...f, use_type: e.target.value }))}
              className="border-border bg-surface-2 text-foreground h-11 w-full rounded-lg border px-3.5 text-sm"
            >
              <option value="both">Adult + medical</option>
              <option value="adult">Adult use</option>
              <option value="medical">Medical</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            className="accent-primary h-4 w-4"
          />
          Enabled (applied at checkout)
        </label>
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {form.id ? 'Save tax' : 'Add tax'}
        </Button>
      </form>
    </div>
  );
}
