import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Heart,
  KeyRound,
  ShoppingBag,
  Star,
  Store,
} from 'lucide-react';
import { USER_ROLES } from '@weedtip/shared';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/admin';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { setUserRole } from '../actions';

export const metadata: Metadata = { title: 'User · Admin' };
export const dynamic = 'force-dynamic';

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Store;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border-border bg-surface shadow-card border p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
        <Icon className="text-primary h-4 w-4" /> {title}
      </h3>
      {children}
    </section>
  );
}

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString() : '—';

/**
 * Admin 360 view of one user: identity + access (auth email, providers,
 * sign-in activity, role management) and their platform footprint (listings,
 * brands, claims, orders, reviews, favorites).
 */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const service = createServiceClient();

  const [
    { data: profile },
    authRes,
    { data: shops },
    { data: brands },
    { data: claims },
    { data: orders },
    { data: reviews },
    { count: favoriteCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    service.auth.admin.getUserById(id),
    supabase
      .from('dispensaries')
      .select('slug,name,city,state,status')
      .eq('owner_id', id)
      .order('name'),
    supabase.from('brands').select('slug,name,status').eq('owner_id', id).order('name'),
    supabase
      .from('ownership_requests')
      .select('status,created_at,dispensary:dispensaries(slug,name)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('orders')
      .select('id,status,total_cents,order_type,created_at,dispensary:dispensaries(slug,name)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('reviews')
      .select('id,rating,body,created_at,dispensary:dispensaries(slug,name)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('favorites')
      .select('dispensary_id', { count: 'exact', head: true })
      .eq('user_id', id),
  ]);
  if (!profile) notFound();

  const authUser = authRes.data.user;
  const providers = (authUser?.identities ?? []).map((i) => i.provider);
  const orderTotal = (orders ?? []).reduce(
    (sum, o) => (o.status === 'cancelled' ? sum : sum + o.total_cents),
    0,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">{profile.display_name ?? 'Unnamed user'}</h2>
        <Badge tone={profile.role === 'admin' ? 'primary' : 'default'}>
          {profile.role.replace('_', ' ')}
        </Badge>
        {(brands ?? []).length > 0 && <Badge tone="outline">Brand owner</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Identity & access */}
        <Section title="Access" icon={KeyRound}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Email</dt>
              <dd className="truncate font-medium">{authUser?.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Email confirmed</dt>
              <dd>{authUser?.email_confirmed_at ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Sign-in methods</dt>
              <dd className="capitalize">{providers.length ? providers.join(', ') : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Joined</dt>
              <dd>{fmt(authUser?.created_at ?? profile.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Last sign-in</dt>
              <dd>{fmt(authUser?.last_sign_in_at)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">User ID</dt>
              <dd className="font-mono text-xs">{profile.id}</dd>
            </div>
          </dl>

          {/* Role management */}
          <form
            action={async (fd: FormData) => {
              'use server';
              await setUserRole(id, String(fd.get('role')));
            }}
            className="border-border mt-4 flex items-center gap-2 border-t pt-4"
          >
            <label htmlFor="role" className="text-muted text-sm">
              Role
            </label>
            <select
              id="role"
              name="role"
              defaultValue={profile.role}
              className="border-border bg-surface h-9 rounded-lg border px-3 text-sm"
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ')}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="border-border bg-surface hover:border-primary/50 hover:text-primary rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            >
              Update
            </button>
          </form>
        </Section>

        {/* Listings */}
        <Section title={`Listings (${(shops ?? []).length})`} icon={Store}>
          {(shops ?? []).length === 0 ? (
            <p className="text-muted text-sm">No claimed listings.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(shops ?? []).map((s) => (
                <li key={s.slug} className="flex items-center justify-between gap-2">
                  <Link href={`/dispensary/${s.slug}`} className="text-primary truncate hover:underline">
                    {s.name}
                  </Link>
                  <span className="text-muted shrink-0 text-xs">
                    {[s.city, s.state].filter(Boolean).join(', ')} · {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(brands ?? []).length > 0 && (
            <>
              <h4 className="text-muted mb-2 mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <Award className="h-3.5 w-3.5" /> Brands
              </h4>
              <ul className="space-y-1.5 text-sm">
                {(brands ?? []).map((b) => (
                  <li key={b.slug} className="flex items-center justify-between gap-2">
                    <Link href={`/brand/${b.slug}`} className="text-primary truncate hover:underline">
                      {b.name}
                    </Link>
                    <span className="text-muted text-xs">{b.status}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        {/* Claims */}
        <Section title={`Ownership claims (${(claims ?? []).length})`} icon={BadgeCheck}>
          {(claims ?? []).length === 0 ? (
            <p className="text-muted text-sm">No claims filed.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(claims ?? []).map((c, i) => {
                const disp = c.dispensary as { slug: string; name: string } | null;
                return (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="truncate">{disp?.name ?? 'Unknown listing'}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge
                        tone={
                          c.status === 'approved'
                            ? 'primary'
                            : c.status === 'rejected'
                              ? 'muted'
                              : 'outline'
                        }
                      >
                        {c.status}
                      </Badge>
                      <span className="text-muted text-xs">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Orders */}
        <Section title={`Orders (${(orders ?? []).length}${(orders ?? []).length === 10 ? '+' : ''})`} icon={ShoppingBag}>
          {(orders ?? []).length === 0 ? (
            <p className="text-muted text-sm">No orders yet.</p>
          ) : (
            <>
              <p className="text-muted mb-2 text-xs">
                {formatPrice(orderTotal)} across recent non-cancelled orders
              </p>
              <ul className="space-y-2 text-sm">
                {(orders ?? []).map((o) => {
                  const disp = o.dispensary as { slug: string; name: string } | null;
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {disp?.name ?? '—'}{' '}
                        <span className="text-muted text-xs">· {o.order_type}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-medium">{formatPrice(o.total_cents)}</span>
                        <Badge tone={o.status === 'cancelled' ? 'muted' : 'outline'}>
                          {o.status}
                        </Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>

        {/* Reviews */}
        <Section title="Recent reviews" icon={Star}>
          {(reviews ?? []).length === 0 ? (
            <p className="text-muted text-sm">No reviews written.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(reviews ?? []).map((r) => {
                const disp = r.dispensary as { slug: string; name: string } | null;
                return (
                  <li key={r.id}>
                    <p className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{disp?.name ?? '—'}</span>
                      <span className="text-primary shrink-0 text-xs font-semibold">
                        {r.rating}/5
                      </span>
                    </p>
                    {r.body && <p className="text-muted mt-0.5 line-clamp-2 text-xs">{r.body}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Engagement */}
        <Section title="Engagement" icon={Heart}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Saved dispensaries</dt>
              <dd className="font-medium">{favoriteCount ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Welcomed</dt>
              <dd>{profile.welcomed_at ? fmt(profile.welcomed_at) : 'Not yet'}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </div>
  );
}
