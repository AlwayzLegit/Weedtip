import type { Metadata } from 'next';
import Link from 'next/link';
import { STRAIN_TYPES, type StrainType } from '@weedtip/shared';
import { StrainCard } from '@/components/strain-card';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Strains',
  description: 'Explore cannabis strains — effects, flavors, and where to buy.',
};

const TYPE_LABEL: Record<string, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export default async function StrainsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeType = STRAIN_TYPES.includes(type as StrainType) ? (type as StrainType) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from('strains')
    .select('slug,name,type,effects,thc_low,thc_high')
    .order('name');
  if (activeType) query = query.eq('type', activeType);
  const { data: strains } = await query;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Strains</h1>
        <p className="text-muted mt-1">Explore effects, flavors, and where to find each strain.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/strains"
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
            !activeType
              ? 'border-primary bg-primary-muted text-primary'
              : 'border-border text-muted hover:text-foreground',
          )}
        >
          All
        </Link>
        {STRAIN_TYPES.map((t) => (
          <Link
            key={t}
            href={`/strains?type=${t}`}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              activeType === t
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground',
            )}
          >
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      {!strains || strains.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No strains found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {strains.map((s) => (
            <StrainCard
              key={s.slug}
              s={{
                slug: s.slug,
                name: s.name,
                type: s.type,
                effects: s.effects,
                thcLow: s.thc_low,
                thcHigh: s.thc_high,
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
