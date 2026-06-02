import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, LayoutDashboard, Package, ShoppingBag, Store, Tag } from 'lucide-react';
import { getAuth } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/listing', label: 'Listing', icon: Store },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/deals', label: 'Deals', icon: Tag },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getAuth();
  if (!user) redirect('/sign-in');
  if (profile?.role !== 'dispensary_owner' && profile?.role !== 'admin') redirect('/');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside>
          <nav className="flex gap-2 lg:flex-col">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="text-muted hover:bg-surface-2 hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
