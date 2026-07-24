import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { Search } from 'lucide-react';
import { STRAIN_TYPES, type StrainType } from '@weedtip/shared';
import { StrainCard } from '@/components/strain-card';
import { Input } from '@/components/ui/input';
import { pageSeo } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Strains',
  description:
    'Explore cannabis strains — effects, flavors, THC ranges, and which dispensaries carry them on Weedtip.',
  path: '/strains',
});

const TYPE_LABEL: Record<string, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export default async function StrainsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { type, q } = await searchParams;
  const activeType = STRAIN_TYPES.includes(type as StrainType) ? (type as StrainType) : undefined;
  const search = (q ?? '').trim();

  const supabase = await createClient();
  let query = supabase
    .from('strains')
    .select('slug,name,type,effects,thc_low,thc_high')
    .order('name');
  if (activeType) query = query.eq('type', activeType);
  if (search) query = query.ilike('name', `%${search}%`);
  const { data: strains } = await query;

  const typeHref = (t?: string) => {
    const p = new URLSearchParams();
    if (t) p.set('type', t);
    if (search) p.set('q', search);
    const qs = p.toString();
    return `/strains${qs ? `?${qs}` : ''}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Discover</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Strains</h1>
          <p className="text-muted mt-1">
            Explore effects, flavors, and where to find each strain.
          </p>
        </div>
        <form className="relative w-full sm:w-64">
          {activeType && <input type="hidden" name="type" value={activeType} />}
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input name="q" defaultValue={search} placeholder="Search strains…" className="pl-9" />
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={typeHref()}
          className={cn(
            'focus-visible:ring-primary rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
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
            href={typeHref(t)}
            className={cn(
              'focus-visible:ring-primary rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
              activeType === t
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground',
            )}
          >
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      <p className="text-muted mb-4 text-sm">
        {strains?.length ?? 0} {strains?.length === 1 ? 'strain' : 'strains'}
        {search ? ` for “${search}”` : ''}
      </p>

      {!strains || strains.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border border-dashed p-10 text-center">
          <p className="text-foreground font-medium">No strains found</p>
          <p className="mt-1 text-sm">
            {search
              ? `Nothing matches "${search}"${activeType ? ` in ${TYPE_LABEL[activeType]}` : ''}.`
              : 'No strains in this filter yet.'}
          </p>
          {(search || activeType) && (
            <Link
              href="/strains"
              className="border-primary text-primary hover:bg-primary-muted focus-visible:ring-primary mt-4 inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              Browse all strains
            </Link>
          )}
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
