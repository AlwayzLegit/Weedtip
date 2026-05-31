'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { STRAIN_TYPES } from '@weedtip/shared';
import { Select } from './ui/select';

export interface FilterCategory {
  name: string;
  slug: string;
}

const STRAIN_LABELS: Record<string, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export function ProductFilters({ categories }: { categories: FilterCategory[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div>
        <label className="text-muted mb-1 block text-xs">Category</label>
        <Select
          value={searchParams.get('category') ?? ''}
          onChange={(e) => setParam('category', e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="text-muted mb-1 block text-xs">Strain</label>
        <Select
          value={searchParams.get('strain') ?? ''}
          onChange={(e) => setParam('strain', e.target.value)}
        >
          <option value="">Any strain</option>
          {STRAIN_TYPES.map((s) => (
            <option key={s} value={s}>
              {STRAIN_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="text-muted mb-1 block text-xs">Max price ($)</label>
        <Select
          value={searchParams.get('max_price') ?? ''}
          onChange={(e) => setParam('max_price', e.target.value)}
        >
          <option value="">Any</option>
          {[20, 40, 60, 100, 200].map((p) => (
            <option key={p} value={String(p * 100)}>
              Under ${p}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="text-muted mb-1 block text-xs">Sort / stock</label>
        <Select
          value={searchParams.get('in_stock') ?? 'true'}
          onChange={(e) => setParam('in_stock', e.target.value)}
        >
          <option value="true">In stock only</option>
          <option value="false">Include out of stock</option>
        </Select>
      </div>
    </div>
  );
}
