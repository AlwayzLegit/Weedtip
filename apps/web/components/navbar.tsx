import { Link } from 'next-view-transitions';
import { getAuth } from '@/lib/auth';
import { ownsAnyBrand } from '@/lib/brand-owner';
import { notificationHref } from '@/lib/notification-href';
import { createClient } from '@/lib/supabase/server';
import { Logo } from './brand/logo';
import { GlobalSearch } from './global-search';
import { MarketSelector } from './market-selector';
import { NavMenu } from './nav-menu';

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
        .select('id,type,title,body,created_at,read,data')
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
      href: notificationHref(n.type, n.data),
    }));
    isBrandOwner = await ownsAnyBrand(user.id);
  }

  return (
    <header className="border-border/70 bg-background/70 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="Weedtip home" className="shrink-0">
          <Logo />
        </Link>
        {/* Weedmaps-style location-driven header: the market picker scopes the
            homepage feed, browse map, and deals; the header search takes over
            the hero search's job everywhere. */}
        <GlobalSearch className="mx-1 hidden max-w-xl flex-1 md:block" />
        <MarketSelector className="hidden shrink-0 sm:block" />
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
      {/* Mobile: search + location get their own header row (the hero search
          box is gone — the header owns search on every screen size). */}
      <div className="flex items-center gap-2 px-4 pb-3 md:hidden">
        <GlobalSearch className="min-w-0 flex-1" />
        <MarketSelector className="shrink-0 sm:hidden" />
      </div>
    </header>
  );
}
