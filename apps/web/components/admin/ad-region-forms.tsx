'use client';

import { useActionState } from 'react';
import {
  compSlot,
  setAdBoundary,
  upsertAdRegion,
  upsertAdZone,
} from '@/app/admin/ad-region-actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

const SELECT_CLASS =
  'border-border bg-surface-2 text-foreground h-10 w-full rounded-lg border px-3 text-sm';

export interface RegionFormValues {
  id?: string;
  marketId: string;
  name?: string;
  slug?: string;
  tier?: string;
  exclusiveMinCents?: number | null;
  exclusiveMaxCents?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

export function AdRegionForm({ region }: { region: RegionFormValues }) {
  const [state, action] = useActionState(upsertAdRegion, EMPTY_FORM_STATE);
  return (
    <form action={action} className="card space-y-3 p-5">
      <FormMessage state={state} />
      {region.id && <input type="hidden" name="id" value={region.id} />}
      <input type="hidden" name="market_id" value={region.marketId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" placeholder="Region name" defaultValue={region.name ?? ''} required />
        <Input name="slug" placeholder="slug (auto from name)" defaultValue={region.slug ?? ''} />
        <select name="tier" defaultValue={region.tier ?? 'A'} className={SELECT_CLASS} aria-label="Tier">
          <option value="A_PLUS">Tier A+</option>
          <option value="A">Tier A</option>
          <option value="B_PLUS">Tier B+</option>
          <option value="B">Tier B</option>
        </select>
        <Input
          name="sort_order"
          type="number"
          placeholder="Sort order"
          defaultValue={region.sortOrder ?? 0}
          aria-label="Sort order"
        />
        <Input
          name="exclusive_min_dollars"
          type="number"
          placeholder="Exclusive band min ($/mo)"
          defaultValue={region.exclusiveMinCents != null ? region.exclusiveMinCents / 100 : ''}
        />
        <Input
          name="exclusive_max_dollars"
          type="number"
          placeholder="Exclusive band max ($/mo)"
          defaultValue={region.exclusiveMaxCents != null ? region.exclusiveMaxCents / 100 : ''}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={region.isActive ?? true}
          className="accent-primary h-4 w-4"
        />
        Active (serving + sellable)
      </label>
      <SubmitButton size="sm">{region.id ? 'Save region' : 'Create region'}</SubmitButton>
    </form>
  );
}

export function AdZoneForm({ regionId }: { regionId: string }) {
  const [state, action] = useActionState(upsertAdZone, EMPTY_FORM_STATE);
  return (
    <form action={action} className="card space-y-3 p-5">
      <FormMessage state={state} />
      <input type="hidden" name="region_id" value={regionId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" placeholder="Zone name (e.g. Sherman Oaks)" required />
        <Input name="slug" placeholder="slug (auto from name)" />
        <Input name="lng" type="number" step="any" placeholder="Centroid longitude" required />
        <Input name="lat" type="number" step="any" placeholder="Centroid latitude" required />
      </div>
      <SubmitButton size="sm">Add zone</SubmitButton>
    </form>
  );
}

export function AdBoundaryForm({
  kind,
  targetId,
  label,
}: {
  kind: 'region' | 'zone';
  targetId: string;
  label: string;
}) {
  const [state, action] = useActionState(setAdBoundary, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-2">
      <FormMessage state={state} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="target_id" value={targetId} />
      <Textarea
        name="geojson"
        rows={4}
        placeholder={`Paste GeoJSON Polygon/MultiPolygon geometry for ${label} (replaces the current boundary; validated with ST_IsValid). Leave empty and submit to clear.`}
        className="font-mono text-xs"
      />
      <SubmitButton size="sm">Set boundary</SubmitButton>
    </form>
  );
}

export function CompSlotForm({
  slots,
}: {
  slots: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(compSlot, EMPTY_FORM_STATE);
  if (slots.length === 0) {
    return <p className="text-muted text-sm">No open slots — every position has a live subscription.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="slot_id" className={SELECT_CLASS} aria-label="Open slot" required>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <Input name="dispensary_slug" placeholder="Dispensary slug" required />
        <Input
          name="price_dollars"
          type="number"
          step="any"
          placeholder="Negotiated $/mo (0 = comp)"
        />
      </div>
      <SubmitButton size="sm">Place manually (comp)</SubmitButton>
    </form>
  );
}
