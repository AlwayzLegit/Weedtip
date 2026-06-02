import Link from 'next/link';
import {
  Award,
  BadgeCheck,
  Leaf,
  MapPin,
  Package,
  Shield,
  ShoppingBag,
  Store,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/admin';

const NAV = [
  { href: '/admin', label: 'Overview', icon: Shield },
  { href: '/admin/dispensaries', label: 'Dispensaries', icon: Store },
  { href: '/admin/claims', label: 'Claims', icon: BadgeCheck },
  { href: '/admin/categories', label: 'Categories', icon: Package },
  { href: '/admin/strains', label: 'Strains', icon: Leaf },
  { href: '/admin/brands', label: 'Brands', icon: Award },
  { href: '/admin/regions', label: 'Regions', icon: MapPin },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/users', label: 'Users', icon: Users },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Shield className="text-primary h-5 w-5" />
        <h1 className="text-lg font-semibold">Admin</h1>
        <Badge tone="primary">Platform</Badge>
      </div>
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside>
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="text-muted hover:bg-surface-2 hover:text-foreground flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
