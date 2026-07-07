import { Link } from 'next-view-transitions';
import { ChevronRight } from 'lucide-react';
import { breadcrumbJsonLd } from '@/lib/seo';
import { JsonLd } from './seo/json-ld';

export interface Crumb {
  name: string;
  /** Site-relative path for this crumb (including the current page). */
  href: string;
}

/**
 * Accessible breadcrumb trail + matching BreadcrumbList JSON-LD (Google rich
 * results). Pass an ordered list ending with the current page; the last item
 * renders as plain text but still contributes its URL to the schema.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted mb-4 text-sm">
      <JsonLd data={breadcrumbJsonLd(items.map((c) => ({ name: c.name, path: c.href })))} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1.5">
              {last ? (
                <span className="text-foreground font-medium" aria-current="page">
                  {c.name}
                </span>
              ) : (
                // -my/py pad the tap target to ~36px without moving the text.
                <Link href={c.href} className="hover:text-foreground -my-2 py-2 transition-colors">
                  {c.name}
                </Link>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
