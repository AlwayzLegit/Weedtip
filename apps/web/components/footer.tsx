import { cookies } from 'next/headers';
import { Link } from 'next-view-transitions';
import { getAuth } from '@/lib/auth';
import { activeStateCounts } from '@/lib/locations';
import { getPlatformSettings } from '@/lib/settings';
import { DealAlertSignup } from './deal-alert-signup';
import { Logo } from './brand/logo';
import { PaymentLogos } from './payment-logos';

// Only link destinations that resolve 200 for an anonymous visitor. The footer
// renders on all ~17k pages, so a single link to a redirecting or auth-gated URL
// multiplies into ~17k redirect hits in a crawl (Semrush flagged exactly that):
//   • /map was retired into /dispensaries (301) — the route stays for old inbound
//     deep links, but "Dispensaries" already IS the map-first view.
//   • /studio is auth-gated (307 → /sign-in or /for-brands). Brand owners reach it
//     from the nav menu, which gates on actual brand ownership; "For brands" is
//     the public entry point.
const DISCOVER = [
  { href: '/dispensaries', label: 'Dispensaries' },
  { href: '/deliveries', label: 'Deliveries' },
  { href: '/deals', label: 'Nearby deals' },
  { href: '/brands', label: 'Brands' },
  { href: '/products', label: 'Products' },
  { href: '/strains', label: 'Strains' },
  { href: '/learn', label: 'Learn' },
];

// No public Advertise link: rate cards are for accounts with listings
// (owners reach /advertise from their dashboard). Acquisition paths stay.
const BUSINESS = [
  { href: '/claim', label: 'List your shop' },
  { href: '/for-brands', label: 'For brands' },
];

const LEGAL = [
  { href: '/terms', label: 'Terms of use' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/refunds', label: 'Refunds & cancellations' },
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
            <Link
              href={l.href}
              className="text-muted hover:text-foreground -my-2 inline-block py-2"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Footer() {
  const [{ user }, settings, states] = await Promise.all([
    getAuth(),
    getPlatformSettings(),
    // Top states by listing count — puts every state directory hub one click
    // from any page so the state → city → shop tree is crawlable, not sitemap-
    // only (SEO cause C). Cached hourly; "All locations" links the full index.
    activeStateCounts(),
  ]);
  const topStates = states.slice(0, 12);
  // Localize the deal-alert copy to the visitor's chosen market (nav selector
  // writes the wt_state cookie). Falls back to a generic "near you".
  const marketState = (await cookies()).get('wt_state')?.value ?? null;
  return (
    <footer className="border-border mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="border-border mb-10 border-b pb-10">
          <DealAlertSignup source="footer" defaultState={marketState} />
        </div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="max-w-xs space-y-2 lg:col-span-2">
            <Logo />
            <p className="text-muted text-sm">
              Find licensed dispensaries near you. Browse menus, compare prices, read reviews, and
              discover the best cannabis deals.
            </p>
            {/* Business contact — required on-site for payment processing. */}
            <address className="text-muted text-sm not-italic">
              {settings.phoneE164 && settings.phoneDisplay && (
                <>
                  <a href={`tel:${settings.phoneE164}`} className="hover:text-foreground">
                    {settings.phoneDisplay}
                  </a>
                  <br />
                </>
              )}
              {settings.addressLine}
            </address>
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
        {topStates.length > 0 && (
          <div className="border-border mt-10 border-t pt-8">
            <p className="text-foreground mb-3 text-sm font-semibold">
              Browse dispensaries by state
            </p>
            <nav className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {topStates.map((s) => (
                <Link
                  key={s.code}
                  href={`/dispensaries/${s.code.toLowerCase()}`}
                  className="text-muted hover:text-foreground -my-1 inline-block py-1"
                >
                  {s.name}
                </Link>
              ))}
              <Link
                href="/dispensaries/locations"
                className="text-primary -my-1 inline-block py-1 font-medium hover:underline"
              >
                All locations →
              </Link>
            </nav>
          </div>
        )}

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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p>© {new Date().getFullYear()} Weedtip. All rights reserved.</p>
            <PaymentLogos />
          </div>
        </div>
      </div>
    </footer>
  );
}
