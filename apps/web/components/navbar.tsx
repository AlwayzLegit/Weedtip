import Link from 'next/link';
import { getAuth } from '@/lib/auth';
import { Logo } from './brand/logo';
import { NavMenu } from './nav-menu';

export async function Navbar() {
  const { user, profile } = await getAuth();

  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" aria-label="Weedtip home">
          <Logo />
        </Link>
        <NavMenu
          email={user?.email ?? null}
          displayName={profile?.display_name ?? null}
          isOwner={profile?.role === 'dispensary_owner'}
          isAdmin={profile?.role === 'admin'}
        />
      </div>
    </header>
  );
}
