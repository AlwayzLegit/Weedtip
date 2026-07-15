import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Full-page "upgrade to proceed" wall for a gated (Growth) feature. Free owners
 * still reach the page — they see what the feature is and a one-click path to
 * upgrade, rather than a hard 404/redirect.
 */
export function UpgradeWall({
  feature,
  description,
}: {
  feature: string;
  description?: string;
}) {
  return (
    <div className="rounded-card border-border bg-surface shadow-card border p-8 text-center sm:p-12">
      <div className="bg-primary-muted text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-full">
        <Lock className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">{feature} is a Growth feature</h2>
      <p className="text-muted mx-auto mt-1.5 max-w-md text-sm">
        {description ??
          'Upgrade to Growth to unlock it. Your free listing stays live at 0% commission — Growth just adds marketing tools, POS, and advanced analytics.'}
      </p>
      <Link href="/dashboard/promote" className="mt-5 inline-block">
        <Button size="lg">
          <Sparkles className="h-4 w-4" /> Upgrade to Growth
        </Button>
      </Link>
    </div>
  );
}

/**
 * Slim inline banner for list pages that stay visible on the free plan — it
 * explains the gate and links to upgrade without hiding existing content.
 */
export function UpgradeBanner({ message }: { message: string }) {
  return (
    <div className="rounded-card border-primary/30 bg-primary-muted flex flex-wrap items-center justify-between gap-3 border p-4">
      <p className="text-primary flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 shrink-0" />
        {message}
      </p>
      <Link href="/dashboard/promote" className="shrink-0">
        <Button size="sm">Upgrade to Growth</Button>
      </Link>
    </div>
  );
}
