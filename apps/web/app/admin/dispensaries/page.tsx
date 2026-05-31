import type { Metadata } from 'next';
import Link from 'next/link';
import { DISPENSARY_STATUSES } from '@weedtip/shared';
import { ModerationButtons } from '@/components/admin/moderation-buttons';
import { Badge } from '@/components/ui/badge';
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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = DISPENSARY_STATUSES.includes(status as never) ? status : undefined;

  const supabase = await createClient();
  let query = supabase
    .from('dispensaries')
    .select('id,name,slug,city,state,status,featured,created_at')
    .order('created_at', { ascending: false });
  if (active) query = query.eq('status', active as never);
  const { data: dispensaries } = await query;

  const filters = [
    { key: undefined, label: 'All' },
    ...DISPENSARY_STATUSES.map((s) => ({ key: s, label: s })),
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Dispensaries</h2>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.key ? `/admin/dispensaries?status=${f.key}` : '/admin/dispensaries'}
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

      {!dispensaries || dispensaries.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No dispensaries{active ? ` with status “${active}”` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {dispensaries.map((d) => (
            <div
              key={d.id}
              className="rounded-card border-border bg-surface flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
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
