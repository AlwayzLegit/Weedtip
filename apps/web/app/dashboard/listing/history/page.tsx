import type { Metadata } from 'next';
import Link from 'next/link';
import { History } from 'lucide-react';
import type { Json } from '@weedtip/supabase/types';
import { Badge } from '@/components/ui/badge';
import { requireMemberCapability } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Listing history' };

/** Friendly labels for audited columns; unlisted keys fall back to the raw key. */
const FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  slug: 'URL slug',
  description: 'About',
  announcement: 'Announcement',
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  latitude: 'Latitude',
  longitude: 'Longitude',
  hours: 'Hours',
  special_hours: 'Holiday hours',
  timezone: 'Timezone',
  amenities: 'Amenities',
  logo_url: 'Logo',
  cover_image_url: 'Cover photo',
  gallery_urls: 'Photo gallery',
  video_url: 'Video',
  is_delivery: 'Delivery',
  is_pickup: 'Pickup',
  is_medical: 'Medical',
  is_recreational: 'Recreational',
  license_number: 'License #',
  require_id: 'Require ID',
  post_order_message: 'Post-order message',
  accepting_orders: 'Accepting orders',
  status: 'Status',
  featured: 'Featured',
  grandfathered: 'Grandfathered',
};

/** Fields whose values are too long/structured to show inline — say "updated". */
const COMPLEX_FIELDS = new Set([
  'hours',
  'special_hours',
  'amenities',
  'gallery_urls',
  'description',
  'announcement',
  'post_order_message',
  'logo_url',
  'cover_image_url',
  'video_url',
]);

function shortValue(v: Json | undefined): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 42 ? `${s.slice(0, 42)}…` : s || '—';
}

type Diff = Record<string, { from: Json; to: Json }>;

/**
 * Listing change history (roadmap ②, final parity item): a field-level audit
 * trail of every edit to the listing — who changed what, when. Populated by the
 * dispensary_audit DB trigger, so edits from every surface (dashboard, admin,
 * Google sync) are captured.
 */
export default async function ListingHistoryPage() {
  const { dispensary } = await requireMemberCapability('listing');
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from('dispensary_audit_log')
    .select('id, actor_id, changes, created_at, actor:profiles(display_name)')
    .eq('dispensary_id', dispensary.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Listing</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <History className="text-primary h-7 w-7" /> Change history
          </h1>
          <p className="text-muted mt-1 text-sm">
            Every edit to {dispensary.name} — who changed what, and when. Edits from the
            dashboard, admins, and Google sync are all recorded.
          </p>
        </div>
        <Link
          href="/dashboard/listing"
          className="border-border bg-surface hover:border-primary/50 shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
        >
          ← Back to listing
        </Link>
      </div>

      {(entries ?? []).length === 0 ? (
        <div className="card text-muted p-10 text-center text-sm">
          No changes recorded yet. History starts collecting from your next edit.
        </div>
      ) : (
        <ol className="space-y-3">
          {(entries ?? []).map((e) => {
            const actor = e.actor as { display_name: string | null } | null;
            const diff = (e.changes ?? {}) as Diff;
            const keys = Object.keys(diff);
            return (
              <li key={e.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {actor?.display_name ?? (e.actor_id ? 'Team member' : 'System')}
                  </span>
                  <time className="text-muted text-xs" dateTime={e.created_at}>
                    {new Date(e.created_at).toLocaleString()}
                  </time>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {keys.slice(0, 8).map((k) => (
                    <li key={k} className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="muted">{FIELD_LABEL[k] ?? k}</Badge>
                      {COMPLEX_FIELDS.has(k) ? (
                        <span className="text-muted">updated</span>
                      ) : (
                        <span className="text-muted">
                          {shortValue(diff[k]?.from)}{' '}
                          <span className="text-foreground font-medium">→ {shortValue(diff[k]?.to)}</span>
                        </span>
                      )}
                    </li>
                  ))}
                  {keys.length > 8 && (
                    <li className="text-muted text-xs">+{keys.length - 8} more fields</li>
                  )}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
