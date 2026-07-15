import 'server-only';
import { createServiceClient } from './supabase/service';

/**
 * In-app notification helpers. Rows are written with the service-role client
 * because `notifications` has no INSERT policy (recipients can only read/update
 * their own) — the same trusted-writer pattern the DB triggers use.
 *
 * Every send is best-effort: a failure is logged but never bubbles up, so a
 * notification hiccup can't fail the action that triggered it. Store the
 * deep-link in `data.href` so the notifications UI can route to it directly.
 */

export type NotifyInput = {
  type: string;
  title: string;
  body?: string | null;
  /** Deep link for the notifications list (e.g. '/dashboard/claims'). */
  href?: string;
  /** Extra structured payload merged into the row's `data`. */
  data?: Record<string, unknown>;
};

function buildRow(userId: string, n: NotifyInput) {
  return {
    user_id: userId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    data: { ...(n.href ? { href: n.href } : {}), ...(n.data ?? {}) },
  };
}

/** Notify a single user. */
export async function notifyUser(userId: string, n: NotifyInput): Promise<void> {
  if (!userId) return;
  try {
    const svc = createServiceClient();
    const { error } = await svc.from('notifications').insert(buildRow(userId, n));
    if (error) console.error('[notify] user insert failed:', error.message);
  } catch (e) {
    console.error('[notify] user send threw:', e);
  }
}

/** Notify several users at once. */
export async function notifyUsers(userIds: string[], n: NotifyInput): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const svc = createServiceClient();
    const { error } = await svc.from('notifications').insert(ids.map((id) => buildRow(id, n)));
    if (error) console.error('[notify] users insert failed:', error.message);
  } catch (e) {
    console.error('[notify] users send threw:', e);
  }
}

/** Notify every admin (role = 'admin'). Used for claims, new listings, billing. */
export async function notifyAdmins(n: NotifyInput): Promise<void> {
  try {
    const svc = createServiceClient();
    const { data: admins, error } = await svc.from('profiles').select('id').eq('role', 'admin');
    if (error) {
      console.error('[notify] admin lookup failed:', error.message);
      return;
    }
    await notifyUsers((admins ?? []).map((a) => a.id), n);
  } catch (e) {
    console.error('[notify] admins send threw:', e);
  }
}
