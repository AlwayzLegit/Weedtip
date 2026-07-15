'use client';

import { Link } from 'next-view-transitions';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Bell } from 'lucide-react';
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions/notifications';
import { cn } from '@/lib/utils';

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  read: boolean;
  href: string | null;
};

/** Short relative time, e.g. "just now", "3h", "2d". */
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
}

/** Bell + dropdown of recent notifications, with mark-read and a "view all" link. */
export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [, start] = useTransition();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="text-foreground hover:bg-surface-2 relative inline-flex h-10 w-10 items-center justify-center rounded-lg"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="rounded-card border-border bg-surface shadow-card-hover sheen animate-slide-up absolute right-0 top-12 z-50 w-80 border"
        >
          <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <form action={markAllNotificationsRead}>
                <button type="submit" className="text-primary text-xs font-medium hover:underline">
                  Mark all read
                </button>
              </form>
            )}
          </div>

          <div className="max-h-96 overflow-auto">
            {notifications.length === 0 ? (
              <p className="text-muted px-4 py-8 text-center text-sm">You're all caught up.</p>
            ) : (
              notifications.map((n) => {
                const Inner = (
                  <>
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full" aria-hidden />
                      )}
                      <div className={cn('min-w-0 flex-1', n.read && 'pl-4')}>
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.body && <p className="text-muted mt-0.5 line-clamp-2 text-xs">{n.body}</p>}
                        <p className="text-muted mt-0.5 text-[11px]">{ago(n.created_at)}</p>
                      </div>
                    </div>
                  </>
                );
                const cls = cn(
                  'block px-4 py-3 text-left transition-colors hover:bg-surface-2',
                  !n.read && 'bg-primary-muted/40',
                );
                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    role="menuitem"
                    onClick={() => !n.read && start(() => markNotificationRead(n.id))}
                    className={cls}
                  >
                    {Inner}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    role="menuitem"
                    onClick={() => !n.read && start(() => markNotificationRead(n.id))}
                    className={cn(cls, 'w-full')}
                  >
                    {Inner}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-border border-t px-4 py-2 text-center">
            <Link href="/notifications" role="menuitem" className="text-primary text-sm font-medium hover:underline">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
