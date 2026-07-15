'use client';

import Link from 'next/link';
import { Check, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { finishOnboarding } from '@/app/welcome/actions';
import { readMarketCookie, writeMarketCookie } from '@/components/market-selector';
import { US_STATES } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { SubmitButton } from '../auth/submit-button';

type Category = { name: string; slug: string };

/**
 * Shopper first-run: pick a location, favorite categories, and opt into deal
 * alerts. Every step is optional and the whole thing is skippable — the goal is
 * a little personalization, not a gate. Location writes the same market cookie
 * the header selector uses, so it carries across the whole site immediately.
 */
export function WelcomeFlow({
  categories,
  initialCategories,
}: {
  categories: Category[];
  initialCategories: string[];
}) {
  const [state, setState] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set(initialCategories));

  // Seed the location from whatever the market cookie already holds (geo-set on
  // first visit), so returning users see their state pre-filled.
  useEffect(() => {
    const c = readMarketCookie();
    if (c) setState(c);
  }, []);

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function onStateChange(code: string) {
    setState(code);
    writeMarketCookie(code || null);
  }

  return (
    <form action={finishOnboarding} className="space-y-8">
      <input type="hidden" name="state" value={state} />
      {[...selected].map((slug) => (
        <input key={slug} type="hidden" name="category" value={slug} />
      ))}

      {/* Location */}
      <section>
        <h2 className="flex items-center gap-1.5 font-semibold">
          <MapPin className="text-primary h-4 w-4" /> Where are you shopping?
        </h2>
        <p className="text-muted mt-0.5 text-sm">We&apos;ll show shops and deals near you.</p>
        <select
          value={state}
          onChange={(e) => onStateChange(e.target.value)}
          className="border-border bg-surface-2 text-foreground mt-3 h-11 w-full max-w-xs rounded-lg border px-3.5 text-sm"
          aria-label="Your state"
        >
          <option value="">Select your state…</option>
          {Object.entries(US_STATES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </section>

      {/* Favorite categories */}
      <section>
        <h2 className="font-semibold">What are you into?</h2>
        <p className="text-muted mt-0.5 text-sm">
          Pick a few favorites to personalize your feed (optional).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = selected.has(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggle(c.slug)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  on
                    ? 'border-primary bg-primary-muted text-primary'
                    : 'border-border text-muted hover:text-foreground',
                )}
                aria-pressed={on}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {c.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Deal alerts */}
      <section>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="deal_alerts"
            defaultChecked
            className="border-border text-primary focus:ring-primary mt-0.5 h-4 w-4 rounded"
          />
          <span>
            <span className="font-medium">Email me the best deals</span>
            <span className="text-muted block text-sm">
              A weekly roundup of top deals in your area. Unsubscribe anytime.
            </span>
          </span>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton size="lg">Save &amp; start browsing</SubmitButton>
        <Link href="/" className="text-muted text-sm hover:underline">
          Skip for now
        </Link>
      </div>
    </form>
  );
}
