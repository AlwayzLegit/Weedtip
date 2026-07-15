'use client';

import { Link } from 'next-view-transitions';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Shield,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { CartButton } from './cart/cart-button';
import { GlobalSearch } from './global-search';
import { NotificationsBell, type NotificationItem } from './notifications-bell';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

// Primary destinations stay inline on desktop; the rest fold into a Browse
// dropdown so the header doesn't crowd at laptop widths.
const PRIMARY = [
  { href: '/dispensaries', label: 'Dispensaries' },
  { href: '/deliveries', label: 'Deliveries' },
  { href: '/deals', label: 'Deals' },
];
const SECONDARY = [
  { href: '/products', label: 'Products' },
  { href: '/brands', label: 'Brands' },
  { href: '/strains', label: 'Strains' },
  { href: '/learn', label: 'Learn' },
];
const BROWSE = [...PRIMARY, ...SECONDARY];

export function NavMenu({
  email,
  displayName,
  isOwner,
  isAdmin,
  isBrandOwner = false,
  unreadCount = 0,
  notifications = [],
}: {
  email: string | null;
  displayName: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  isBrandOwner?: boolean;
  unreadCount?: number;
  notifications?: NotificationItem[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);

  // Close everything on route change.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
    setBrowseOpen(false);
  }, [pathname]);

  // Close the dropdowns on outside click / Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (browseRef.current && !browseRef.current.contains(e.target as Node)) setBrowseOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setBrowseOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const roleLabel = isAdmin ? 'Admin' : isOwner ? 'Owner' : isBrandOwner ? 'Brand owner' : 'Shopper';
  const roleTone: 'primary' | 'outline' | 'muted' = isAdmin
    ? 'primary'
    : isOwner || isBrandOwner
      ? 'outline'
      : 'muted';
  const initial = (displayName ?? email ?? '?').charAt(0).toUpperCase();

  const navLink = (link: { href: string; label: string }) => (
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
  );

  const secondaryActive = SECONDARY.some((l) => pathname.startsWith(l.href));
  const browseDropdown = (
    <div className="relative" ref={browseRef}>
      <button
        type="button"
        onClick={() => setBrowseOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={browseOpen}
        className={cn(
          'hover:text-foreground inline-flex items-center gap-1 text-sm font-medium transition-colors',
          secondaryActive ? 'text-foreground' : 'text-muted',
        )}
      >
        Browse
        <ChevronDown className={cn('h-4 w-4 transition-transform', browseOpen && 'rotate-180')} />
      </button>
      {browseOpen && (
        <div
          role="menu"
          className="rounded-card border-border bg-surface shadow-card-hover sheen animate-slide-up absolute left-0 top-10 z-50 w-44 border p-2"
        >
          {SECONDARY.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              className={cn(
                'hover:bg-surface-2 hover:text-foreground block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(link.href) ? 'text-foreground' : 'text-muted',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  // Role-aware account items: consoles first (owner/admin), then shopper essentials.
  const accountItems = (
    <>
      {isAdmin && <MenuItem href="/admin" icon={Shield} label="Admin console" />}
      {isOwner && <MenuItem href="/dashboard" icon={Store} label="Owner dashboard" />}
      {isBrandOwner && <MenuItem href="/studio" icon={Sparkles} label="Brand Studio" />}
      {(isAdmin || isOwner || isBrandOwner) && <div className="border-border my-1 border-t" />}
      <MenuItem href="/notifications" icon={Bell} label="Notifications" />
      <MenuItem href="/orders" icon={Receipt} label="Your orders" />
      <MenuItem href="/account/favorites" icon={Heart} label="Favorites" />
      <MenuItem href="/account" icon={Settings} label="Account settings" />
    </>
  );

  // One auth entry point (marketplace convention) — the sign-in page carries
  // the "create an account" path, so the header doesn't need two buttons.
  const signedOutButtons = (
    <Link href="/sign-in">
      <Button size="sm">Sign in</Button>
    </Link>
  );

  return (
    <>
      {/* Desktop: three core destinations + Browse dropdown (the full list
          lives in the mobile drawer and the footer). */}
      <nav className="hidden items-center gap-5 lg:flex">
        {PRIMARY.map(navLink)}
        {browseDropdown}
        <CartButton />
        {email && <NotificationsBell notifications={notifications} unreadCount={unreadCount} />}
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
                className="rounded-card border-border bg-surface shadow-card-hover sheen animate-slide-up absolute right-0 top-12 z-50 w-64 border p-2"
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
      <div className="flex items-center gap-1 lg:hidden">
        <CartButton />
        <button
          className="text-foreground -m-2 p-2"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={drawerOpen}
        >
          {drawerOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setDrawerOpen(false)}
            className="bg-background/60 animate-fade-in fixed inset-0 top-16 z-40 lg:hidden"
          />
          <div className="glass animate-slide-up shadow-card-hover absolute inset-x-0 top-16 z-50 border-b p-4 lg:hidden">
            <nav className="flex flex-col gap-4">
              <GlobalSearch />
              <div className="flex flex-col gap-1">
                {BROWSE.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      pathname.startsWith(link.href)
                        ? 'bg-primary-muted text-primary'
                        : 'text-muted hover:bg-surface-2 hover:text-foreground',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

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
        </>
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
