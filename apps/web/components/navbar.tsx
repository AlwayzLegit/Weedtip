import Link from 'next/link';
import { getAuth } from '@/lib/auth';
import { ownsAnyBrand } from '@/lib/brand-owner';
import { createClient } from '@/lib/supabase/server';
import { Logo } from './brand/logo';
import { GlobalSearch } from './global-search';
import { NavMenu } from './nav-menu';

export async function Navbar() {
  const { user, profile } = await getAuth();

  let unreadCount = 0;
  let isBrandOwner = false;
  if (user) {
    const supabase = await createClient();
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false);
    unreadCount = count ?? 0;
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
        />
      </div>
    </header>
  );
}
