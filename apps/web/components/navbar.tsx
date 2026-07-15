import { Link } from 'next-view-transitions';
import { getAuth } from '@/lib/auth';
import { ownsAnyBrand } from '@/lib/brand-owner';
import { createClient } from '@/lib/supabase/server';
import { Logo } from './brand/logo';
import { GlobalSearch } from './global-search';
import { NavMenu } from './nav-menu';

/** Deep link for a notification: explicit href, else legacy id shapes. */
function hrefFromData(data: unknown): string | null {
  const d = (data ?? {}) as { href?: string; order_id?: string; brand_slug?: string };
  return d.href ?? (d.order_id ? `/orders/${d.order_id}` : d.brand_slug ? `/brand/${d.brand_slug}` : null);
}

export async function Navbar() {
  const { user, profile } = await getAuth();

  let unreadCount = 0;
  let isBrandOwner = false;
  let notifications: {
    id: string;
    title: string;
    body: string | null;
    created_at: string;
    read: boolean;
    href: string | null;
  }[] = [];
  if (user) {
    const supabase = await createClient();
    const [{ count }, { data: recent }] = await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
      supabase
        .from('notifications')
        .select('id,title,body,created_at,read,data')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);
    unreadCount = count ?? 0;
    notifications = (recent ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      created_at: n.created_at,
      read: n.read,
      href: hrefFromData(n.data),
    }));
    isBrandOwner = await ownsAnyBrand(user.id);
  }

  return (
    <header className="border-border/70 bg-background/70 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" aria-label="Weedtip home" className="shrink-0">
          <Logo />
        </Link>
        {/* Location is set by searching (type a city → map) — no separate
            state dropdown. Wider search fills the freed space. */}
        <GlobalSearch className="mx-4 hidden max-w-xl flex-1 md:block" />
        <NavMenu
          email={user?.email ?? null}
          displayName={profile?.display_name ?? null}
          isOwner={profile?.role === 'dispensary_owner'}
          isAdmin={profile?.role === 'admin'}
          isBrandOwner={isBrandOwner}
          unreadCount={unreadCount}
          notifications={notifications}
        />
      </div>
    </header>
  );
}
