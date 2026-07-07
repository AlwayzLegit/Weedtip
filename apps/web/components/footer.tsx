import { Link } from 'next-view-transitions';
import { getAuth } from '@/lib/auth';
import { Logo } from './brand/logo';

const DISCOVER = [
  { href: '/dispensaries', label: 'Dispensaries' },
  { href: '/deliveries', label: 'Deliveries' },
  { href: '/map', label: 'Map' },
  { href: '/deals', label: 'Nearby deals' },
  { href: '/brands', label: 'Brands' },
  { href: '/products', label: 'Products' },
  { href: '/strains', label: 'Strains' },
  { href: '/learn', label: 'Learn' },
];

const BUSINESS = [
  { href: '/sign-up', label: 'List your shop' },
  { href: '/advertise', label: 'Advertise' },
  { href: '/dashboard', label: 'Owner dashboard' },
  { href: '/studio', label: 'Brand Studio' },
];

const LEGAL = [
  { href: '/terms', label: 'Terms of use' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/disclaimer', label: 'Disclaimer' },
];

function Column({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-foreground mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            {/* -my/py grow the tap target to ~36px without changing spacing. */}
            <Link href={l.href} className="text-muted hover:text-foreground -my-2 inline-block py-2">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Footer() {
  const { user } = await getAuth();
  return (
    <footer className="border-border mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="max-w-xs space-y-2 lg:col-span-2">
            <Logo />
            <p className="text-muted text-sm">
              The Google Maps of cannabis. Discover licensed dispensaries near you, browse live
              menus, and order for pickup or delivery.
            </p>
          </div>
          <Column title="Discover" links={DISCOVER} />
          <Column title="For business" links={BUSINESS} />
          <Column
            title="Account"
            links={
              user
                ? [
                    { href: '/account', label: 'Account settings' },
                    { href: '/orders', label: 'Your orders' },
                    { href: '/account/favorites', label: 'Favorites' },
                  ]
                : [
                    { href: '/sign-in', label: 'Sign in' },
                    { href: '/sign-up', label: 'Sign up' },
                  ]
            }
          />
        </div>
        <div className="border-border text-muted mt-10 border-t pt-6 text-xs">
          <nav className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground -my-2 py-2">
                {l.label}
              </Link>
            ))}
          </nav>
          <p>
            For use by adults 21 and older. Cannabis products have not been evaluated by the FDA.
          </p>
          <p className="mt-1">© {new Date().getFullYear()} Weedtip. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
