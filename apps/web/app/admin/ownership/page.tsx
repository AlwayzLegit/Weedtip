import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, Search, Store, UserCircle } from 'lucide-react';
import {
  GrandfatherToggle,
  ReleaseOwnerButton,
  TransferOwnerForm,
} from '@/components/admin/ownership-controls';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { requireAdmin } from '@/lib/admin';
import { getOwnershipRoster, type OwnerRow } from '@/lib/ownership';
import { TIER_LABEL, type PlanTier } from '@/lib/plan';

export const metadata: Metadata = { title: 'Ownership · Admin' };

const TIER_TONE: Record<PlanTier, 'primary' | 'default' | 'muted'> = {
  growth: 'primary',
  basic: 'default',
  free: 'muted',
};

function statusTone(status: string): 'live' | 'scheduled' | 'inactive' {
  if (status === 'active') return 'live';
  if (status === 'pending') return 'scheduled';
  return 'inactive';
}

/** Match an owner against the search box (email, name, or any asset name/slug). */
function matches(o: OwnerRow, q: string): boolean {
  if (!q) return true;
  const hay = [
    o.email,
    o.displayName,
    ...o.dispensaries.flatMap((d) => [d.name, d.slug, d.city]),
    ...o.brands.flatMap((b) => [b.name, b.slug]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default async function AdminOwnership({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const search = (q ?? '').trim();

  const roster = await getOwnershipRoster();
  const owners = roster.owners.filter((o) => matches(o, search));

  const stats = [
    { label: 'Owners', value: roster.owners.length },
    { label: 'Claimed listings', value: roster.claimedDispensaries },
    { label: 'Unclaimed listings', value: roster.unclaimedDispensaries },
    { label: 'Owned brands', value: roster.ownedBrands },
    { label: 'Unowned brands', value: roster.unownedBrands },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Manage</p>
          <h2 className="text-2xl font-bold">Ownership</h2>
          <p className="text-muted mt-1 text-sm">
            Every account that owns a listing or brand, what they own, and its plan tier.
          </p>
        </div>
        <form className="relative w-full sm:w-80">
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input name="q" defaultValue={search} placeholder="Search owner, listing, or brand…" className="pl-9" />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card border-border bg-surface border p-3">
            <p className="text-muted text-xs">{s.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {owners.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title={search ? 'No owners match that search' : 'No owners yet'}
          description={
            search
              ? 'Try an email, listing name, or brand name.'
              : 'Once a claim is approved, the owner and their listings show up here.'
          }
        />
      ) : (
        <div className="space-y-4">
          {owners.map((o) => (
            <div key={o.userId} className="rounded-card border-border bg-surface shadow-card border">
              {/* Owner header */}
              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <UserCircle className="text-muted h-4 w-4 shrink-0" />
                    <span className="truncate">{o.email ?? o.displayName ?? o.userId}</span>
                  </p>
                  <p className="text-muted mt-0.5 text-xs">
                    {o.displayName ? `${o.displayName} · ` : ''}
                    {o.role.replace('_', ' ')} · {o.dispensaries.length} listing
                    {o.dispensaries.length === 1 ? '' : 's'} · {o.brands.length} brand
                    {o.brands.length === 1 ? '' : 's'}
                  </p>
                </div>
                <Badge tone={o.role === 'admin' ? 'primary' : 'muted'}>{o.role.replace('_', ' ')}</Badge>
              </div>

              {/* Dispensaries */}
              {o.dispensaries.length > 0 && (
                <ul className="divide-border/60 divide-y">
                  {o.dispensaries.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <Store className="text-muted h-3.5 w-3.5 shrink-0" />
                          <Link href={`/admin/dispensaries/${d.id}`} className="hover:text-primary font-medium">
                            {d.name}
                          </Link>
                          <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill>
                          <Badge tone={TIER_TONE[d.tier]}>{TIER_LABEL[d.tier]}</Badge>
                          {d.grandfathered && <Badge tone="outline">Grandfathered</Badge>}
                        </p>
                        <p className="text-muted mt-0.5 text-xs">
                          {[d.city, d.state].filter(Boolean).join(', ') || '—'} · /{d.slug}
                          {d.planName ? ` · ${d.planName} subscription` : ' · no subscription'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <GrandfatherToggle dispensaryId={d.id} enabled={d.grandfathered} />
                        <TransferOwnerForm kind="dispensary" id={d.id} />
                        <ReleaseOwnerButton kind="dispensary" id={d.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Brands */}
              {o.brands.length > 0 && (
                <ul className="divide-border/60 divide-y border-t border-dashed">
                  {o.brands.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        <Award className="text-muted h-3.5 w-3.5 shrink-0" />
                        <Link href={`/admin/brands/${b.id}`} className="hover:text-primary font-medium">
                          {b.name}
                        </Link>
                        {b.status && <StatusPill tone={statusTone(b.status)}>{b.status}</StatusPill>}
                        <Badge tone={TIER_TONE[b.tier]}>{TIER_LABEL[b.tier]}</Badge>
                        {b.grandfathered && <Badge tone="outline">Grandfathered</Badge>}
                        <span className="text-muted text-xs">/{b.slug}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        <TransferOwnerForm kind="brand" id={b.id} />
                        <ReleaseOwnerButton kind="brand" id={b.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-muted text-xs">
        Showing {owners.length} of {roster.owners.length} owners
        {search ? ` for “${search}”` : ''}.
      </p>
    </div>
  );
}
