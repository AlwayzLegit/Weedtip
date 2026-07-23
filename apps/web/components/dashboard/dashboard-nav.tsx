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
  Images,
  LayoutDashboard,
  Leaf,
  MapPin,
  CreditCard,
  Megaphone,
  Package,
  Percent,
  Plug,
  QrCode,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { type Capability, type MemberRole, memberCan } from '@/lib/member-roles';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: LucideIcon; cap?: Capability };

const OWNER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/listing', label: 'Listing', icon: Store, cap: 'listing' },
  { href: '/dashboard/products', label: 'Products', icon: Package, cap: 'menu' },
  { href: '/dashboard/deals', label: 'Deals', icon: Tag, cap: 'marketing' },
  { href: '/dashboard/promo-codes', label: 'Promo codes', icon: Ticket, cap: 'marketing' },
  { href: '/dashboard/promos', label: 'In-store', icon: BadgeCheck, cap: 'marketing' },
  { href: '/dashboard/register', label: 'Register', icon: Calculator, cap: 'orders' },
  { href: '/dashboard/taxes', label: 'Taxes', icon: Percent, cap: 'owner' },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag, cap: 'orders' },
  { href: '/dashboard/reviews', label: 'Reviews', icon: Star, cap: 'reviews' },
  { href: '/dashboard/updates', label: 'Updates', icon: Users, cap: 'marketing' },
  { href: '/dashboard/team', label: 'Team', icon: UserCog, cap: 'owner' },
  { href: '/studio', label: 'Brand Studio', icon: Award },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, cap: 'analytics' },
  { href: '/dashboard/qr', label: 'QR codes', icon: QrCode, cap: 'menu' },
  { href: '/dashboard/google', label: 'Google', icon: Globe, cap: 'listing' },
  { href: '/dashboard/promote', label: 'Promote', icon: Megaphone, cap: 'owner' },
  { href: '/advertise', label: 'Advertise', icon: Gavel, cap: 'owner' },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: Shield },
  { href: '/admin/ownership', label: 'Ownership', icon: UserCog },
  { href: '/admin/dispensaries', label: 'Dispensaries', icon: Store },
  { href: '/admin/billing', label: 'Billing', icon: CreditCard },
  { href: '/admin/ads-desk', label: 'Ad desk', icon: Gavel },
  { href: '/admin/promotions', label: 'Promotions', icon: Megaphone },
  { href: '/admin/hero', label: 'Hero carousel', icon: Images },
  { href: '/admin/merch', label: 'Merchandising', icon: Sparkles },
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
  { href: '/admin/seo', label: 'SEO', icon: Search },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

/** Sidebar nav with active-route highlighting, shared by owner + admin shells. */
export function DashboardNav({
  variant,
  showBrandStudio = true,
  memberRole = 'owner',
}: {
  variant: 'owner' | 'admin';
  /** Hide the Brand Studio item for owners who don't manage a brand (avoids a dead-end redirect). */
  showBrandStudio?: boolean;
  /** The active member's role — scopes which nav items show (P4 role matrix). */
  memberRole?: MemberRole;
}) {
  const pathname = usePathname();
  const base = variant === 'owner' ? OWNER_NAV : ADMIN_NAV;
  const items =
    variant === 'owner'
      ? base.filter(
          (i) =>
            (showBrandStudio || i.href !== '/studio') && (!i.cap || memberCan(memberRole, i.cap)),
        )
      : base;
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
