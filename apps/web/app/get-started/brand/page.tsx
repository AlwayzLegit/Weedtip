import { Link } from 'next-view-transitions';
import { redirect } from 'next/navigation';
import { Package, PlusCircle, Search } from 'lucide-react';
import { WizardShell } from '@/components/onboarding/wizard-shell';
import { getAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata = pageSeo({
  title: 'Get started — cannabis brands',
  description:
    'Set up your brand page on Weedtip: your product lineup, the markets you sell in, and the shops that carry you.',
  path: '/get-started/brand',
});

export const dynamic = 'force-dynamic';

/**
 * The brand fork of the wizard.
 *
 * Brands genuinely differ from dispensaries: there's no state license to verify
 * against and most brands aren't pre-listed, so the two paths are "claim the
 * page we already have for you" and "create one". Rather than fake a five-step
 * flow over a two-field form, this is a single honest screen — but it still
 * sits inside the wizard chrome so someone who picked "brand" on step 1 doesn't
 * feel dumped out of the flow.
 */
export default async function BrandGetStartedPage() {
  const { user } = await getAuth();

  // Already running a brand? Studio is the right home.
  if (user) {
    const supabase = await createClient();
    const { data: mine } = await supabase
      .from('brands')
      .select('slug')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();
    if (mine) redirect('/studio');
  }

  return (
    <main>
      <WizardShell
        step="intent"
        title="Get your brand on Weedtip"
        intro="A brand page puts your lineup in front of shoppers browsing the markets you already sell in — and links every product back to the shops that carry it."
        footer={
          <p className="text-muted text-sm">
            Run a dispensary instead?{' '}
            <Link href="/get-started" className="text-primary hover:underline">
              Start the dispensary flow
            </Link>
            .
          </p>
        }
      >
        <div className="space-y-3">
          <Link href="/brands" className="block">
            <div className="rounded-card border-border bg-surface hover:border-primary/60 hover:bg-surface-2 group flex items-start gap-4 border p-5 transition-colors">
              <span className="bg-primary-muted text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <Search className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="group-hover:text-primary block font-semibold transition-colors">
                  My brand is already listed
                </span>
                <span className="text-muted mt-1 block text-sm leading-relaxed">
                  Find it in the brand directory and claim it — your existing page, product links,
                  and any reviews it has already earned come with you.
                </span>
              </span>
            </div>
          </Link>

          <Link href="/brands/new" className="block">
            <div className="rounded-card border-border bg-surface hover:border-primary/60 hover:bg-surface-2 group flex items-start gap-4 border p-5 transition-colors">
              <span className="bg-primary-muted text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <PlusCircle className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="group-hover:text-primary block font-semibold transition-colors">
                  Add my brand
                </span>
                <span className="text-muted mt-1 block text-sm leading-relaxed">
                  Name, site, and a line about what you make. It goes live after a quick review, and
                  you can start adding products right away.
                </span>
              </span>
            </div>
          </Link>

          <div className="rounded-card border-border bg-surface-2 flex flex-wrap items-center justify-between gap-3 border p-4">
            <div className="flex min-w-0 items-center gap-2">
              <Package className="text-muted h-4 w-4 shrink-0" aria-hidden />
              <p className="text-muted text-sm">
                Want the full picture first — placement, markets, and pricing?
              </p>
            </div>
            <Link href="/for-brands">
              <Button variant="outline" size="sm">
                How it works
              </Button>
            </Link>
          </div>
        </div>
      </WizardShell>
    </main>
  );
}
