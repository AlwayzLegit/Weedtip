import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { DISPENSARY_STATUSES } from '@weedtip/shared';
import { ModerationButtons } from '@/components/admin/moderation-buttons';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dispensaries · Admin' };

const TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  active: 'primary',
  pending: 'default',
  suspended: 'muted',
};

export default async function AdminDispensaries({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const active = DISPENSARY_STATUSES.includes(status as never) ? status : undefined;
  const search = (q ?? '').trim();

  const supabase = await createClient();
  let query = supabase
    .from('dispensaries')
    .select('id,name,slug,city,state,status,featured,created_at')
    .order('created_at', { ascending: false });
  if (active) query = query.eq('status', active as never);
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
  const { data: dispensaries } = await query;

  const filters = [
    { key: undefined, label: 'All' },
    ...DISPENSARY_STATUSES.map((s) => ({ key: s, label: s })),
  ];
  const pillHref = (key?: string) => {
    const p = new URLSearchParams();
    if (key) p.set('status', key);
    if (search) p.set('q', search);
    const qs = p.toString();
    return `/admin/dispensaries${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Manage</p>
          <h2 className="text-2xl font-bold">Dispensaries</h2>
        </div>
        <form className="relative w-full sm:w-72">
          {active && <input type="hidden" name="status" value={active} />}
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search name or city…"
            className="pl-9"
          />
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={pillHref(f.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              active === f.key
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground',
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <p className="text-muted text-sm">
        {dispensaries?.length ?? 0} {dispensaries?.length === 1 ? 'result' : 'results'}
        {search ? ` for “${search}”` : ''}
      </p>

      {!dispensaries || dispensaries.length === 0 ? (
        <div className="card text-muted p-10 text-center">
          No dispensaries{active ? ` with status “${active}”` : ''}
          {search ? ` matching “${search}”` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {dispensaries.map((d) => (
            <div
              key={d.id}
              className="rounded-card border-border bg-surface shadow-card hover:border-border-strong flex flex-col gap-3 border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dispensary/${d.slug}`} className="hover:text-primary font-medium">
                    {d.name}
                  </Link>
                  <Badge tone={TONE[d.status] ?? 'default'}>{d.status}</Badge>
                  {d.featured && <Badge tone="primary">Featured</Badge>}
                </div>
                <p className="text-muted text-xs">
                  {d.city}, {d.state} · added {new Date(d.created_at).toLocaleDateString()}
                </p>
              </div>
              <ModerationButtons id={d.id} status={d.status} featured={d.featured} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
