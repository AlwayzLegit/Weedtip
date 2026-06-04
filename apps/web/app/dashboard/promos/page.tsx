import type { Metadata } from 'next';
import Link from 'next/link';
import { deletePromo } from '@/app/actions/promos';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'In-store promos' };

function isLive(p: { is_active: boolean; start_date: string | null; end_date: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  return p.is_active && (!p.start_date || p.start_date <= today) && (!p.end_date || p.end_date >= today);
}

export default async function DashboardPromos() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { data: promos } = await supabase
    .from('dispensary_promos')
    .select('id,title,description,start_date,end_date,sort_order,is_active')
    .eq('dispensary_id', dispensary.id)
    .order('sort_order')
    .order('created_at', { ascending: false });

  const total = promos?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">In-store promos</h1>
          <p className="text-muted mt-1 text-sm">
            Non-menu offers shown on your storefront — claimed in person. Up to 10 ({total}/10 used).
          </p>
        </div>
        {total < 10 && (
          <Link href="/dashboard/promos/new">
            <Button>Add promo</Button>
          </Link>
        )}
      </div>

      {!promos || promos.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No in-store promos yet.
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => (
            <div
              key={p.id}
              className="rounded-card border-border bg-surface flex items-start justify-between gap-3 border p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted text-xs">#{p.sort_order}</span>
                  <p className="font-medium">{p.title}</p>
                  {isLive(p) ? <Badge tone="primary">Live</Badge> : <Badge tone="muted">Hidden</Badge>}
                </div>
                {p.description && <p className="text-muted mt-1 text-sm">{p.description}</p>}
                {(p.start_date || p.end_date) && (
                  <p className="text-muted mt-1 text-xs">
                    {p.start_date ?? '—'} → {p.end_date ?? 'open'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/dashboard/promos/${p.id}`}>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </Link>
                <DeleteButton action={deletePromo.bind(null, p.id)} confirmText="Delete this promo?" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
