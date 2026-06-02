'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Shield,
  Store,
  X,
} from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { CartButton } from './cart/cart-button';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const BROWSE = [
  { href: '/dispensaries', label: 'Dispensaries' },
  { href: '/products', label: 'Products' },
  { href: '/strains', label: 'Strains' },
  { href: '/brands', label: 'Brands' },
  { href: '/deals', label: 'Deals' },
];

export function NavMenu({
  email,
  displayName,
  isOwner,
  isAdmin,
}: {
  email: string | null;
  displayName: string | null;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close everything on route change.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Close the account dropdown on outside click / Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const roleLabel = isAdmin ? 'Admin' : isOwner ? 'Owner' : 'Shopper';
  const roleTone: 'primary' | 'outline' | 'muted' = isAdmin
    ? 'primary'
    : isOwner
      ? 'outline'
      : 'muted';
  const initial = (displayName ?? email ?? '?').charAt(0).toUpperCase();

  const browseLinks = BROWSE.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className={cn(
        'hover:text-foreground text-sm font-medium transition-colors',
        pathname.startsWith(link.href) ? 'text-foreground' : 'text-muted',
      )}
    >
      {link.label}
    </Link>
  ));

  // Role-aware account items: consoles first (owner/admin), then shopper essentials.
  const accountItems = (
    <>
      {isAdmin && <MenuItem href="/admin" icon={Shield} label="Admin console" />}
      {isOwner && <MenuItem href="/dashboard" icon={Store} label="Owner dashboard" />}
      {(isAdmin || isOwner) && <div className="border-border my-1 border-t" />}
      <MenuItem href="/orders" icon={Receipt} label="Your orders" />
      <MenuItem href="/account/favorites" icon={Heart} label="Favorites" />
      <MenuItem href="/account" icon={Settings} label="Account settings" />
    </>
  );

  const signedOutButtons = (
    <div className="flex items-center gap-2">
      <Link href="/sign-in">
        <Button variant="ghost" size="sm">
          Sign in
        </Button>
      </Link>
      <Link href="/sign-up">
        <Button size="sm">Sign up</Button>
      </Link>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <nav className="hidden items-center gap-6 md:flex">
        {browseLinks}
        <CartButton />
        {email ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="hover:bg-surface-2 flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors"
            >
              <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                {initial}
              </span>
              <ChevronDown className="text-muted h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="rounded-card border-border bg-surface absolute right-0 top-12 z-50 w-64 border p-2 shadow-xl"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">{displayName ?? 'Your account'}</p>
                  <p className="text-muted truncate text-xs">{email}</p>
                  <Badge tone={roleTone} className="mt-2">
                    {roleLabel}
                  </Badge>
                </div>
                <div className="border-border my-1 border-t" />
                {accountItems}
                <div className="border-border my-1 border-t" />
                <form action={signOut}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="text-muted hover:bg-surface-2 hover:text-foreground flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          signedOutButtons
        )}
      </nav>

      {/* Mobile: cart + hamburger */}
      <div className="flex items-center gap-1 md:hidden">
        <CartButton />
        <button
          className="text-foreground"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={drawerOpen}
        >
          {drawerOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="border-border bg-background absolute inset-x-0 top-16 z-50 border-b p-4 md:hidden">
          <nav className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">{browseLinks}</div>

            <div className="border-border border-t pt-4">
              {email ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {displayName ?? 'Your account'}
                      </p>
                      <p className="text-muted truncate text-xs">{email}</p>
                    </div>
                    <Badge tone={roleTone}>{roleLabel}</Badge>
                  </div>
                  {accountItems}
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="text-muted hover:bg-surface-2 hover:text-foreground flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </form>
                </div>
              ) : (
                signedOutButtons
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="text-muted hover:bg-surface-2 hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
