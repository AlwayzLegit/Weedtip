import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Which plan a gated feature upgrades to. Kept as a local literal (not imported
 * from lib/plan, which is server-only) so this renders anywhere.
 */
type UpgradeTier = 'basic' | 'growth';
const TIER_NAME: Record<UpgradeTier, string> = { basic: 'Basic', growth: 'Growth' };

/**
 * Full-page "upgrade to proceed" wall for a gated feature. Free owners still
 * reach the page — they see what the feature is and a one-click path to upgrade,
 * rather than a hard 404/redirect.
 */
export function UpgradeWall({
  feature,
  description,
  tier = 'growth',
}: {
  feature: string;
  description?: string;
  tier?: UpgradeTier;
}) {
  const plan = TIER_NAME[tier];
  return (
    <div className="rounded-card border-border bg-surface shadow-card border p-8 text-center sm:p-12">
      <div className="bg-primary-muted text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-full">
        <Lock className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">
        {feature} is a {plan} feature
      </h2>
      <p className="text-muted mx-auto mt-1.5 max-w-md text-sm">
        {description ??
          `Upgrade to ${plan} to unlock it. Your free listing stays live at 0% commission — paid plans just add tools on top.`}
      </p>
      <Link href="/dashboard/promote" className="mt-5 inline-block">
        <Button size="lg">
          <Sparkles className="h-4 w-4" /> Upgrade to {plan}
        </Button>
      </Link>
    </div>
  );
}

/**
 * Slim inline banner for list pages that stay visible on the free plan — it
 * explains the gate and links to upgrade without hiding existing content.
 */
export function UpgradeBanner({
  message,
  tier = 'growth',
}: {
  message: string;
  tier?: UpgradeTier;
}) {
  const plan = TIER_NAME[tier];
  return (
    <div className="rounded-card border-primary/30 bg-primary-muted flex flex-wrap items-center justify-between gap-3 border p-4">
      <p className="text-primary flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 shrink-0" />
        {message}
      </p>
      <Link href="/dashboard/promote" className="shrink-0">
        <Button size="sm">Upgrade to {plan}</Button>
      </Link>
    </div>
  );
}
