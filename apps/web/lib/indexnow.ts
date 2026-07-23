/**
 * IndexNow submission.
 *
 * IndexNow lets us push "this URL changed, please (re)crawl it" to the search
 * engines that support the protocol — Bing, Yandex, Naver, Seznam — instead of
 * waiting for them to rediscover pages. Submitting to the api.indexnow.org hub
 * fans the ping out to every participating engine.
 *
 * NOTE: Google does NOT participate in IndexNow (confirmed 2026) — it still
 * relies on sitemaps + crawl discovery. So this helps everyone *except* Google;
 * for Google we lean on the sitemap and the GSC coverage monitor. It's still a
 * free, low-risk win on the other engines (and the AI crawlers that read them).
 *
 * The key is public by design: it's served as a static file at
 * `${SITE_URL}/${INDEXNOW_KEY}.txt` so an engine can verify we own the host
 * before trusting our submissions. Keep the constant and that file in sync.
 */
import { SITE_URL } from './site';

export const INDEXNOW_KEY = '7c2f4e28ef2ccf7b90c82e2b5954ee45';

const HOST = new URL(SITE_URL).host; // e.g. www.weedtip.com
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** IndexNow caps a single submission at 10,000 URLs. */
export const INDEXNOW_MAX_BATCH = 10_000;

export type IndexNowResult = { ok: boolean; status: number; submitted: number };

/**
 * Submit a batch of same-host URLs. Off-host URLs are dropped (IndexNow rejects
 * a batch that mixes hosts). Returns the HTTP status; 200/202 mean accepted.
 */
export async function submitUrls(urls: string[]): Promise<IndexNowResult> {
  const list = [...new Set(urls)].filter((u) => u.startsWith(SITE_URL)).slice(0, INDEXNOW_MAX_BATCH);
  if (list.length === 0) return { ok: true, status: 204, submitted: 0 };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList: list }),
  });
  return { ok: res.ok, status: res.status, submitted: list.length };
}

/** Convenience for a single URL (e.g. fire-and-forget when a listing changes). */
export async function submitUrl(url: string): Promise<IndexNowResult> {
  return submitUrls([url]);
}
