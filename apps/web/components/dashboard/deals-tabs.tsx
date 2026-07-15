import { Link } from 'next-view-transitions';
import { CalendarRange, List } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/dashboard/deals', label: 'List', key: 'list', icon: List },
  { href: '/dashboard/deals/schedule', label: 'Schedule', key: 'schedule', icon: CalendarRange },
] as const;

/** Segmented List / Schedule switch shared by the Deals views. */
export function DealsTabs({ active }: { active: 'list' | 'schedule' }) {
  return (
    <div className="border-border bg-surface-2 inline-flex rounded-lg border p-0.5">
      {TABS.map(({ href, label, key, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors',
            active === key
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </div>
  );
}
