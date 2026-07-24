'use client';

import { useEffect, useState } from 'react';

export type Section = { id: string; label: string };

/**
 * Sticky in-page section nav (Weedmaps pattern) with scroll-spy: the tab for the
 * section currently in view highlights, and clicking a tab smooth-scrolls to it.
 * Server passes only the sections that actually rendered.
 */
export function DispensarySectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (inView[0]) setActive(inView[0].target.id);
      },
      // Trigger when a section's top passes just under the sticky bar.
      { rootMargin: '-96px 0px -55% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active tab visible in the horizontally scrollable strip on mobile.
  // Scrolls only the strip (not the page — scrollIntoView could jump the
  // viewport to the nav on load).
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      `nav[aria-label="Page sections"] a[href="#${active}"]`,
    );
    const strip = el?.parentElement;
    if (!el || !strip) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollTo({ left, behavior: 'smooth' });
    else if (right > strip.scrollLeft + strip.clientWidth)
      strip.scrollTo({ left: right - strip.clientWidth, behavior: 'smooth' });
  }, [active]);

  return (
    <nav
      aria-label="Page sections"
      className="border-border/70 bg-background/85 sticky top-16 z-30 -mx-4 mt-6 border-b px-4 backdrop-blur-xl"
    >
      <div className="relative">
        <div
          aria-hidden
          className="from-background/85 pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l to-transparent sm:hidden"
        />
        <div className="scrollbar-none flex items-center gap-1 overflow-x-auto py-2">
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={
                  'shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ' +
                  (isActive
                    ? 'bg-primary-muted text-primary font-semibold'
                    : 'text-muted hover:bg-surface-2 hover:text-foreground font-medium')
                }
              >
                {s.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
