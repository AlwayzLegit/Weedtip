import 'server-only';
import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';

/**
 * IP-based sliding-window rate limiting backed by Upstash Redis.
 *
 * Fail-open by design: if Upstash isn't configured (UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN unset) or the limiter errors, requests are allowed —
 * so local dev, previews, and Redis outages never lock users out. Set the two
 * env vars in production to activate enforcement.
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, limit: number, window: Duration): Ratelimit | null {
  if (!redis) return null;
  const key = `${name}:${limit}:${window}`;
  let rl = limiters.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `weedtip:rl:${name}`,
      analytics: false,
    });
    limiters.set(key, rl);
  }
  return rl;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? '127.0.0.1';
}

/**
 * Returns `{ success }`. `success` is true when allowed (including when the
 * limiter is disabled). Pass `identifier` to key on something other than IP
 * (e.g. a user id); defaults to the client IP.
 */
export async function rateLimit(
  name: string,
  opts: { limit: number; window: Duration },
  identifier?: string,
): Promise<{ success: boolean }> {
  const rl = getLimiter(name, opts.limit, opts.window);
  if (!rl) return { success: true };
  try {
    const id = identifier ?? (await clientIp());
    const { success } = await rl.limit(id);
    return { success };
  } catch {
    return { success: true };
  }
}
