import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Heart, Receipt, User } from 'lucide-react';
import { getAuth } from '@/lib/auth';

const TABS = [
  { href: '/account', label: 'Profile', icon: User },
  { href: '/account/favorites', label: 'Favorites', icon: Heart },
  { href: '/orders', label: 'Orders', icon: Receipt },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuth();
  if (!user) redirect('/sign-in');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Account</h1>
      <nav className="border-border mb-8 flex gap-2 border-b">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="text-muted hover:text-foreground flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
