import type { ReactNode } from 'react';

/** Shared container for legal/policy pages: centered prose with a title + updated date. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted mt-2 text-sm">Last updated: {updated}</p>
      <div className="text-foreground/90 mt-8 space-y-6 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:text-foreground/90">
        {children}
      </div>
    </div>
  );
}
