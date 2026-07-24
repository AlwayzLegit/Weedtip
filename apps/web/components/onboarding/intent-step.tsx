import { Package, Store } from 'lucide-react';
import { chooseIntent } from '@/app/get-started/actions';

const OPTIONS = [
  {
    value: 'dispensary',
    icon: Store,
    title: 'I run a dispensary or delivery service',
    body: 'Claim your listing to manage your menu, hours, photos, and deals. Every licensed shop is already in the directory.',
  },
  {
    value: 'brand',
    icon: Package,
    title: 'I run a cannabis brand',
    body: 'Set up a brand page with your product lineup, and get it in front of shoppers in the markets you sell in.',
  },
] as const;

/**
 * Step 1. Two doors, because dispensaries and brands have genuinely different
 * paths — a dispensary claims an existing state-licensed listing, a brand
 * usually creates one. Asking here is what keeps the next four steps relevant.
 */
export function IntentStep() {
  return (
    <div className="space-y-3">
      {OPTIONS.map((o) => (
        <form key={o.value} action={chooseIntent}>
          <input type="hidden" name="intent" value={o.value} />
          <button
            type="submit"
            className="rounded-card border-border bg-surface hover:border-primary/60 hover:bg-surface-2 focus-visible:ring-primary group flex w-full items-start gap-4 border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <span className="bg-primary-muted text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
              <o.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="group-hover:text-primary block font-semibold transition-colors">
                {o.title}
              </span>
              <span className="text-muted mt-1 block text-sm leading-relaxed">{o.body}</span>
            </span>
          </button>
        </form>
      ))}
    </div>
  );
}
