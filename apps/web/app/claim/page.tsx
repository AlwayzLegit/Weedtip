import { Link } from 'next-view-transitions';
import { BadgeCheck, Search, Store, UserPlus } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import { pageSeo } from '@/lib/seo';

export const metadata = pageSeo({
  title: 'Claim your dispensary listing',
  description:
    'Dispensary owners: claim your free Weedtip listing to manage your menu, hours, photos, deals, and orders. Claims are verified against the state license on file.',
  path: '/claim',
});

const STEPS = [
  {
    icon: Search,
    title: 'Find your dispensary',
    body: 'Search the directory for your shop — every licensed dispensary already has a free organic listing.',
  },
  {
    icon: UserPlus,
    title: 'Create a business account',
    body: 'Sign up as a dispensary owner (free). Already have an account? Just sign in.',
  },
  {
    icon: BadgeCheck,
    title: 'Submit your claim',
    body: 'Hit "Claim this listing" on your dispensary’s page. We verify the claim against the state license on file.',
  },
];

/**
 * Owner-acquisition landing: how claiming works, with paths into the
 * directory and business sign-up. The claim itself happens on the
 * dispensary's own page (ClaimListing).
 */
export default function ClaimPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Claim your listing', href: '/claim' },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Claim your dispensary listing</h1>
      <p className="text-muted mt-2">
        Your shop is already on Weedtip. Claiming is free and takes a few minutes — once verified,
        you manage the menu, hours, photos, deals, and orders yourself.
      </p>

      <div className="mt-4">
        <Link href="/get-started">
          <Button size="lg">
            <Store className="h-4 w-4" /> Start now
          </Button>
        </Link>
      </div>

      <ol className="mt-8 space-y-4">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="rounded-card border-border bg-surface flex items-start gap-4 border p-5"
          >
            <span className="bg-primary-muted text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">
                {i + 1}. {s.title}
              </p>
              <p className="text-muted mt-1 text-sm">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <Link href="/get-started">
          <Button size="lg">
            <Store className="h-4 w-4" /> Start now
          </Button>
        </Link>
        <p className="text-muted mt-2 text-sm">
          We&apos;ll walk you through it — find your shop, set up an account, and verify. Not listed
          yet? The same flow adds you.
        </p>
      </div>

      <p className="text-muted mt-8 text-sm">
        Want more reach once you&apos;re verified?{' '}
        <Link href="/advertise" className="text-primary hover:underline">
          See featured and premium placement
        </Link>
        .
      </p>
    </main>
  );
}
