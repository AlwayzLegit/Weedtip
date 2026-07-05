import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@weedtip/supabase/types';
import { slugify } from '@/lib/utils';

/**
 * POS menu sync engine (phase 1). Pulls a dispensary's hosted menu feed —
 * a JSON array (or `{ items: [...] }`) or a CSV with a header row — and
 * reconciles it into `products`:
 *
 *   • every feed row gets an `external_id` (the POS item id, or a stable
 *     slug-derived one), so re-syncs upsert in place;
 *   • feed-managed products missing from the latest feed are marked out of
 *     stock, never deleted (order history references them);
 *   • hand-managed products (NULL external_id) are untouched.
 *
 * Works with either an owner-session client ("Sync now") or the service
 * client (cron) — RLS covers the former, trust the latter.
 */

type Client = SupabaseClient<Database>;

export interface MenuSourceRow {
  id: string;
  dispensary_id: string;
  provider: string;
  feed_url: string;
}

export interface SyncResult {
  ok: boolean;
  imported: number;
  skipped: string[];
  error?: string;
}

const MAX_BYTES = 2_000_000;
const MAX_ITEMS = 2_000;
const FETCH_TIMEOUT_MS = 10_000;
const STRAINS = new Set(['indica', 'sativa', 'hybrid', 'cbd']);

interface FeedItem {
  external_id?: string | number;
  name?: string;
  category?: string;
  price?: number | string;
  price_cents?: number | string;
  brand?: string;
  strain_type?: string;
  thc?: number | string;
  cbd?: number | string;
  unit?: string;
  description?: string;
  image_url?: string;
  in_stock?: boolean | string;
}

/** Minimal CSV line parser: handles quoted fields and escaped quotes. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvToItems(text: string): FeedItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const item: Record<string, string> = {};
    header.forEach((h, i) => {
      if (cells[i]) item[h] = cells[i]!;
    });
    return item as FeedItem;
  });
}

async function fetchFeed(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json, text/csv, text/plain' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Feed responded ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('Feed is larger than 2 MB');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function parseItems(provider: string, text: string): FeedItem[] {
  if (provider === 'csv_url') return csvToItems(text);
  const parsed: unknown = JSON.parse(text);
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : null;
  if (!arr) throw new Error('Feed must be a JSON array or an object with an "items" array');
  return arr as FeedItem[];
}

const num = (v: number | string | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Run one source's sync end-to-end, recording the outcome on the row. */
export async function runMenuSync(supabase: Client, source: MenuSourceRow): Promise<SyncResult> {
  await supabase
    .from('menu_sources')
    .update({ status: 'syncing', updated_at: new Date().toISOString() })
    .eq('id', source.id);

  const fail = async (message: string): Promise<SyncResult> => {
    await supabase
      .from('menu_sources')
      .update({
        status: 'error',
        last_error: message.slice(0, 500),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);
    return { ok: false, imported: 0, skipped: [], error: message };
  };

  let items: FeedItem[];
  try {
    const text = await fetchFeed(source.feed_url);
    items = parseItems(source.provider, text).slice(0, MAX_ITEMS);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not fetch the feed.');
  }
  if (items.length === 0) return fail('The feed contained no items.');

  const { data: categories } = await supabase.from('categories').select('id,slug,name');
  const catMap = new Map<string, string>();
  for (const c of categories ?? []) {
    catMap.set(c.slug.toLowerCase(), c.id);
    catMap.set(c.name.toLowerCase(), c.id);
  }

  const skipped: string[] = [];
  const seenIds = new Set<string>();
  const rows: Database['public']['Tables']['products']['Insert'][] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const name = String(it.name ?? '').trim();
    if (!name) {
      skipped.push(`Row ${i + 1}: missing name`);
      continue;
    }
    const categoryId = catMap.get(String(it.category ?? '').trim().toLowerCase());
    if (!categoryId) {
      skipped.push(`Row ${i + 1} (${name}): unknown category "${String(it.category ?? '')}"`);
      continue;
    }
    const cents = num(it.price_cents) ?? (num(it.price) != null ? Math.round(num(it.price)! * 100) : null);
    if (cents == null || cents < 0) {
      skipped.push(`Row ${i + 1} (${name}): invalid price`);
      continue;
    }
    const slug = slugify(name);
    // Stable identity even when the POS export has no item id.
    const externalId = String(it.external_id ?? `slug:${slug}`).slice(0, 200);
    if (seenIds.has(externalId)) {
      skipped.push(`Row ${i + 1} (${name}): duplicate external_id "${externalId}"`);
      continue;
    }
    seenIds.add(externalId);

    const strain = String(it.strain_type ?? '').toLowerCase();
    const thc = num(it.thc);
    const cbd = num(it.cbd);
    const inStockRaw = it.in_stock;
    const inStock =
      typeof inStockRaw === 'boolean'
        ? inStockRaw
        : inStockRaw != null && inStockRaw !== ''
          ? ['true', 'yes', '1', 'y'].includes(String(inStockRaw).toLowerCase())
          : true;

    rows.push({
      dispensary_id: source.dispensary_id,
      category_id: categoryId,
      external_id: externalId,
      name,
      slug,
      brand: String(it.brand ?? '').trim() || null,
      description: String(it.description ?? '').trim() || null,
      strain_type: STRAINS.has(strain)
        ? (strain as Database['public']['Enums']['strain_type'])
        : null,
      thc_percentage: thc != null && thc >= 0 && thc <= 100 ? thc : null,
      cbd_percentage: cbd != null && cbd >= 0 && cbd <= 100 ? cbd : null,
      price_cents: cents,
      unit: String(it.unit ?? '').trim() || null,
      image_urls: it.image_url ? [String(it.image_url)] : undefined,
      in_stock: inStock,
    });
  }
  if (rows.length === 0) {
    return fail(`No valid rows. ${skipped.slice(0, 3).join('; ')}`);
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('products')
      .upsert(rows.slice(i, i + 500), { onConflict: 'dispensary_id,external_id' });
    if (error) return fail(error.message);
  }

  // Feed-managed items that vanished from the feed go out of stock.
  const { data: existing } = await supabase
    .from('products')
    .select('id,external_id')
    .eq('dispensary_id', source.dispensary_id)
    .not('external_id', 'is', null);
  const staleIds = (existing ?? [])
    .filter((p) => p.external_id && !seenIds.has(p.external_id))
    .map((p) => p.id);
  for (let i = 0; i < staleIds.length; i += 500) {
    await supabase
      .from('products')
      .update({ in_stock: false })
      .in('id', staleIds.slice(i, i + 500));
  }

  await supabase
    .from('menu_sources')
    .update({
      status: 'ok',
      last_error: null,
      last_synced_at: new Date().toISOString(),
      items_imported: rows.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', source.id);

  return { ok: true, imported: rows.length, skipped };
}
