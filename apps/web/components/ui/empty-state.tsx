import { Link } from 'next-view-transitions';
import { type LucideIcon } from 'lucide-react';
import { Button } from './button';

/** Consistent empty-state card: icon, title, blurb, and an optional CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-card border-border bg-surface border p-10 text-center">
      {Icon && (
        <div className="bg-surface-2 text-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="text-muted mx-auto mt-1 max-w-sm text-sm">{description}</p>}
      {action && (
        <Link href={action.href} className="mt-4 inline-block">
          <Button size="sm">{action.label}</Button>
        </Link>
      )}
    </div>
  );
}
