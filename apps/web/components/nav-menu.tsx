'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, LogOut, Menu, Receipt, Shield, User, X } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { CartButton } from './cart/cart-button';
import { Button } from './ui/button';

const LINKS = [
  { href: '/dispensaries', label: 'Dispensaries' },
  { href: '/products', label: 'Products' },
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  const navLinks = (
    <>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={close}
          className={cn(
            'hover:text-foreground text-sm font-medium transition-colors',
            pathname.startsWith(link.href) ? 'text-foreground' : 'text-muted',
          )}
        >
          {link.label}
        </Link>
      ))}
    </>
  );

  const authArea = email ? (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && (
        <Link href="/admin" onClick={close}>
          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4" />
            Admin
          </Button>
        </Link>
      )}
      {isOwner && (
        <Link href="/dashboard" onClick={close}>
          <Button variant="outline" size="sm">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      )}
      <Link href="/orders" onClick={close}>
        <Button variant="ghost" size="sm">
          <Receipt className="h-4 w-4" />
          Orders
        </Button>
      </Link>
      <Link href="/account" onClick={close}>
        <Button variant="ghost" size="sm" aria-label="Account">
          <User className="h-4 w-4" />
          <span className="max-w-24 truncate sm:hidden">{displayName ?? 'Account'}</span>
        </Button>
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
          <span className="sm:hidden">Sign out</span>
        </Button>
      </form>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link href="/sign-in" onClick={close}>
        <Button variant="ghost" size="sm">
          Sign in
        </Button>
      </Link>
      <Link href="/sign-up" onClick={close}>
        <Button size="sm">Sign up</Button>
      </Link>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <nav className="hidden items-center gap-6 md:flex">
        {navLinks}
        <CartButton />
        {authArea}
      </nav>

      {/* Mobile: cart + hamburger */}
      <div className="flex items-center gap-1 md:hidden">
        <CartButton />
        <button
          className="text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-border bg-background absolute inset-x-0 top-16 border-b p-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks}
            <div className="border-border border-t pt-4">{authArea}</div>
          </nav>
        </div>
      )}
    </>
  );
}
