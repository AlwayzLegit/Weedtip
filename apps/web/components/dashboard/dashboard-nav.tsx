'use client';

import { Link } from 'next-view-transitions';
import { usePathname } from 'next/navigation';
import {
  Award,
  BadgeCheck,
  BarChart3,
  Calculator,
  Gavel,
  Globe,
  LayoutDashboard,
  Leaf,
  MapPin,
  CreditCard,
  Megaphone,
  Package,
  Percent,
  Plug,
  QrCode,
  Settings,
  Shield,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: LucideIcon };

const OWNER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/listing', label: 'Listing', icon: Store },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/deals', label: 'Deals', icon: Tag },
  { href: '/dashboard/promos', label: 'In-store', icon: BadgeCheck },
  { href: '/dashboard/register', label: 'Register', icon: Calculator },
  { href: '/dashboard/taxes', label: 'Taxes', icon: Percent },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/dashboard/reviews', label: 'Reviews', icon: Star },
  { href: '/dashboard/updates', label: 'Updates', icon: Users },
  { href: '/studio', label: 'Brand Studio', icon: Award },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/qr', label: 'QR codes', icon: QrCode },
  { href: '/dashboard/google', label: 'Google', icon: Globe },
  { href: '/dashboard/promote', label: 'Promote', icon: Megaphone },
  { href: '/advertise', label: 'Advertise', icon: Gavel },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: Shield },
  { href: '/admin/dispensaries', label: 'Dispensaries', icon: Store },
  { href: '/admin/billing', label: 'Billing', icon: CreditCard },
  { href: '/admin/promotions', label: 'Promotions', icon: Megaphone },
  { href: '/admin/claims', label: 'Claims', icon: BadgeCheck },
  { href: '/admin/categories', label: 'Categories', icon: Package },
  { href: '/admin/strains', label: 'Strains', icon: Leaf },
  { href: '/admin/brands', label: 'Brands', icon: Award },
  { href: '/admin/regions', label: 'Regions', icon: MapPin },
  { href: '/admin/ad-regions', label: 'Ad regions', icon: Gavel },
  { href: '/admin/brand-regions', label: 'Brand markets', icon: Award },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

/** Sidebar nav with active-route highlighting, shared by owner + admin shells. */
export function DashboardNav({
  variant,
  showBrandStudio = true,
}: {
  variant: 'owner' | 'admin';
  /** Hide the Brand Studio item for owners who don't manage a brand (avoids a dead-end redirect). */
  showBrandStudio?: boolean;
}) {
  const pathname = usePathname();
  const base = variant === 'owner' ? OWNER_NAV : ADMIN_NAV;
  const items =
    variant === 'owner' && !showBrandStudio ? base.filter((i) => i.href !== '/studio') : base;
  const root = variant === 'owner' ? '/dashboard' : '/admin';

  return (
    <nav className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === root ? pathname === root : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-muted text-primary ring-primary/20 ring-1 ring-inset'
                : 'text-muted hover:bg-surface-2 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
