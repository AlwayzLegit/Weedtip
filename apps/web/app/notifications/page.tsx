import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, Trash2 } from 'lucide-react';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/app/actions/notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAuth } from '@/lib/auth';
import { notificationHref } from '@/lib/notification-href';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const { user } = await getAuth();
  if (!user) redirect('/sign-in?next=/notifications');

  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const list = notifications ?? [];
  const hasUnread = list.some((n) => !n.read);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="text-primary h-5 w-5" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        {hasUnread && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline" size="sm">
              Mark all read
            </Button>
          </form>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          <Bell className="text-muted mx-auto h-8 w-8" />
          <p className="mt-2 font-medium">No notifications yet</p>
          <p className="mt-1 text-sm">Order updates will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((n) => {
            const href = notificationHref(n.type, n.data);
            return (
              <div
                key={n.id}
                className={cn(
                  'rounded-card border p-4',
                  n.read ? 'border-border bg-surface' : 'border-primary/30 bg-primary-muted',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-muted mt-1 text-sm">{n.body}</p>}
                    <p className="text-muted mt-1 text-xs">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                    {href && (
                      <Link
                        href={href}
                        className="text-primary mt-2 inline-block text-sm hover:underline"
                      >
                        View →
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.read && (
                      <form action={markNotificationRead.bind(null, n.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Mark read
                        </Button>
                      </form>
                    )}
                    <form action={deleteNotification.bind(null, n.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger/10"
                        aria-label="Delete notification"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
