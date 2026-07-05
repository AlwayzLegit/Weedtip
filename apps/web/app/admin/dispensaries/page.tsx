import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { DISPENSARY_STATUSES } from '@weedtip/shared';
import { ModerationButtons } from '@/components/admin/moderation-buttons';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { US_STATES } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dispensaries · Admin' };

const TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  active: 'primary',
  pending: 'default',
  suspended: 'muted',
};

const PAGE_SIZE = 50;

export default async function AdminDispensaries({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; state?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const active = DISPENSARY_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const search = (sp.q ?? '').trim();
  const stateCode = (sp.state ?? '').toUpperCase();
  const state = US_STATES[stateCode] ? stateCode : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from('dispensaries')
    .select(
      'id,name,slug,city,state,status,featured,pos_addon,created_at,legal_name,license_number,county,dcc_phone,dcc_email',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (active) query = query.eq('status', active as never);
  if (state) query = query.eq('state', state);
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
  const { data: dispensaries, count } = await query;

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : from + 1;
  const rangeEnd = Math.min(from + PAGE_SIZE, total);

  const filters = [
    { key: undefined, label: 'All' },
    ...DISPENSARY_STATUSES.map((s) => ({ key: s, label: s })),
  ];
  const hrefWith = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: active, q: search || undefined, state, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
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
        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {active && <input type="hidden" name="status" value={active} />}
          <div className="relative min-w-0 flex-1 sm:w-64">
            <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              name="q"
              defaultValue={search}
              placeholder="Search name or city…"
              className="pl-9"
            />
          </div>
          <Select name="state" defaultValue={state ?? ''} className="w-32" aria-label="State">
            <option value="">All states</option>
            {Object.entries(US_STATES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            className="border-border hover:border-border-strong rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={hrefWith({ status: f.key, page: undefined })}
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
        {total.toLocaleString()} {total === 1 ? 'result' : 'results'}
        {search ? ` for “${search}”` : ''}
        {state ? ` in ${US_STATES[state]}` : ''}
        {total > 0 && ` · showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()}`}
      </p>

      {!dispensaries || dispensaries.length === 0 ? (
        <div className="card text-muted p-10 text-center">
          No dispensaries{active ? ` with status “${active}”` : ''}
          {state ? ` in ${US_STATES[state]}` : ''}
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
                  {d.city ? `${d.city}, ${d.state}` : `${d.county ? `${d.county} County` : d.state} · delivery`}{' '}
                  · added {new Date(d.created_at).toLocaleDateString()}
                </p>
                {(d.legal_name || d.license_number || d.dcc_phone || d.dcc_email) && (
                  <p className="text-muted/80 mt-0.5 text-xs">
                    Licensee:{d.legal_name ? ` ${d.legal_name}` : ''}
                    {d.license_number ? ` · ${d.license_number}` : ''}
                    {d.dcc_phone ? ` · ${d.dcc_phone}` : ''}
                    {d.dcc_email ? ` · ${d.dcc_email}` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/dispensaries/${d.id}`}
                  className="border-border hover:border-border-strong rounded-lg border px-3 py-1.5 text-sm font-medium"
                >
                  Edit
                </Link>
                <ModerationButtons
                  id={d.id}
                  status={d.status}
                  featured={d.featured}
                  posAddon={d.pos_addon}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-2">
          {page > 1 ? (
            <Link
              href={hrefWith({ page: String(page - 1) })}
              className="border-border hover:border-border-strong rounded-lg border px-3 py-2 text-sm font-medium"
            >
              ← Previous
            </Link>
          ) : (
            <span className="text-muted rounded-lg border border-transparent px-3 py-2 text-sm">
              ← Previous
            </span>
          )}
          <span className="text-muted text-sm">
            Page {page} of {pageCount.toLocaleString()}
          </span>
          {page < pageCount ? (
            <Link
              href={hrefWith({ page: String(page + 1) })}
              className="border-border hover:border-border-strong rounded-lg border px-3 py-2 text-sm font-medium"
            >
              Next →
            </Link>
          ) : (
            <span className="text-muted rounded-lg border border-transparent px-3 py-2 text-sm">
              Next →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
