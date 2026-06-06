'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Megaphone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/studio', label: 'Profile', icon: Sparkles },
  { href: '/studio/promote', label: 'Promote', icon: Megaphone },
];

/** Sidebar nav for the Brand Studio portal. */
export function BrandStudioNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {NAV.map((item) => {
        const active = item.href === '/studio' ? pathname === '/studio' : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-muted text-primary'
                : 'text-muted hover:bg-surface-2 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" /> {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
