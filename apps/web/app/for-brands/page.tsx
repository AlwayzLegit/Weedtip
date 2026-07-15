import { Link } from 'next-view-transitions';
import { BadgeCheck, PlusCircle, Search, Sparkles, Store } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import { pageSeo } from '@/lib/seo';

export const metadata = pageSeo({
  title: 'Weedtip for brands',
  description:
    'Cannabis brands: claim or create your free Weedtip brand page to enrich every dispensary menu that carries you, reach new shoppers, and see where you sell.',
  path: '/for-brands',
});

const STEPS = [
  {
    icon: Search,
    title: 'Find your brand',
    body: 'Search the brand directory — many brands already have a page from the products dispensaries carry.',
  },
  {
    icon: BadgeCheck,
    title: 'Claim it',
    body: 'Already listed? Claim your brand and we’ll verify you before handing over the keys.',
  },
  {
    icon: PlusCircle,
    title: 'Or create it',
    body: 'New to Weedtip? Create your brand from scratch — it goes live after a quick review.',
  },
  {
    icon: Sparkles,
    title: 'Set up your profile',
    body: 'Add your logo, story, and product catalog in Brand Studio. Your profile enriches every menu that carries you.',
  },
];

/** Brand-acquisition landing: how to get on Weedtip as a brand. */
export default function ForBrandsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'For brands', href: '/for-brands' },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Put your brand in front of shoppers</h1>
      <p className="text-muted mt-2">
        A Weedtip brand page enriches every dispensary menu that carries your products — for free.
        Claim your brand or create it in minutes.
      </p>

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

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/brands">
          <Button size="lg">
            <Store className="h-4 w-4" /> Find your brand
          </Button>
        </Link>
        <Link href="/brands/new">
          <Button size="lg" variant="outline">
            <PlusCircle className="h-4 w-4" /> Create your brand
          </Button>
        </Link>
      </div>

      <p className="text-muted mt-8 text-sm">
        New to Weedtip?{' '}
        <Link href="/sign-up?role=brand" className="text-primary hover:underline">
          Create a free brand account
        </Link>
        .
      </p>
    </main>
  );
}
