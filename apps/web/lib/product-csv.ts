import type { Database } from '@weedtip/supabase';
import { slugify } from '@/lib/utils';

export type ProductInsert = Database['public']['Tables']['products']['Insert'];
/** Product fields minus the shop id — filled in per-caller (single vs bulk). */
export type ProductFields = Omit<ProductInsert, 'dispensary_id'>;

/** RFC-4180-ish single-line CSV split (handles quoted fields + escaped quotes). */
export function parseCsvLine(line: string): string[] {
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

const IMPORT_STRAINS = new Set(['indica', 'sativa', 'hybrid', 'cbd']);

/** Category slug/name → id, built once and passed in (both callers already load it). */
export type CategoryMap = Map<string, string>;

export function buildCategoryMap(
  categories: { id: string; slug: string; name: string }[] | null,
): CategoryMap {
  const m: CategoryMap = new Map();
  for (const c of categories ?? []) {
    m.set(c.slug.toLowerCase(), c.id);
    m.set(c.name.toLowerCase(), c.id);
  }
  return m;
}

// ─── Shared column resolution + per-row building ─────────────────────────────

interface ProductCols {
  name: number;
  category: number;
  price: number;
  brand: number;
  strain: number;
  thc: number;
  cbd: number;
  unit: number;
  description: number;
  inStock: number;
}

function resolveCols(header: string[]): ProductCols {
  const idx = (name: string) => header.indexOf(name);
  return {
    name: idx('name'),
    category: idx('category'),
    price: idx('price'),
    brand: idx('brand'),
    strain: idx('strain_type'),
    thc: idx('thc'),
    cbd: idx('cbd'),
    unit: idx('unit'),
    description: idx('description'),
    inStock: idx('in_stock'),
  };
}

/** Build one product's fields from a parsed row, or an error string. */
function buildRow(
  cells: string[],
  ci: ProductCols,
  categoryMap: CategoryMap,
  rowNum: number,
): { fields: ProductFields } | { error: string } {
  const get = (col: number) => (col >= 0 ? (cells[col] ?? '').trim() : '');

  const name = get(ci.name);
  if (!name) return { error: `Row ${rowNum}: missing name` };
  const categoryId = categoryMap.get(get(ci.category).toLowerCase());
  if (!categoryId) return { error: `Row ${rowNum} (${name}): unknown category "${get(ci.category)}"` };
  const price = Number(get(ci.price));
  if (!Number.isFinite(price) || price < 0) return { error: `Row ${rowNum} (${name}): invalid price` };

  const strain = get(ci.strain).toLowerCase();
  const thc = Number(get(ci.thc));
  const cbd = Number(get(ci.cbd));
  const inStock = get(ci.inStock).toLowerCase();

  return {
    fields: {
      category_id: categoryId,
      name,
      slug: slugify(name),
      brand: get(ci.brand) || null,
      description: get(ci.description) || null,
      strain_type: IMPORT_STRAINS.has(strain)
        ? (strain as Database['public']['Enums']['strain_type'])
        : null,
      thc_percentage: Number.isFinite(thc) && thc >= 0 && thc <= 100 ? thc : null,
      cbd_percentage: Number.isFinite(cbd) && cbd >= 0 && cbd <= 100 ? cbd : null,
      price_cents: Math.round(price * 100),
      unit: get(ci.unit) || null,
      in_stock: inStock ? ['true', 'yes', '1', 'y'].includes(inStock) : true,
    },
  };
}

// ─── Single-shop parse (owner import + admin per-shop seed) ──────────────────

export type CsvParseResult =
  | { ok: false; message: string }
  | { ok: true; rows: ProductInsert[]; errors: string[] };

/**
 * Parse a pasted product CSV into product upsert rows for one dispensary.
 * Format: name/category/price required; brand, strain_type, thc, cbd, unit,
 * description, in_stock optional. Rows upsert by (dispensary_id, slug).
 */
export function parseProductsCsv(
  csv: string,
  dispensaryId: string,
  categoryMap: CategoryMap,
): CsvParseResult {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { ok: false, message: 'Paste a CSV with a header row and at least one product row.' };
  }
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const ci = resolveCols(header);
  if (ci.name < 0 || ci.category < 0 || ci.price < 0) {
    return { ok: false, message: 'CSV must include at least "name", "category", and "price" columns.' };
  }

  const rows: ProductInsert[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const built = buildRow(parseCsvLine(lines[i]!), ci, categoryMap, i);
    if ('error' in built) errors.push(built.error);
    else rows.push({ dispensary_id: dispensaryId, ...built.fields });
  }
  return { ok: true, rows, errors };
}

// ─── Bulk parse (admin, many shops in one CSV) ───────────────────────────────

export interface BulkParsedRow {
  /** Raw shop key from the CSV — a license number or a listing slug. */
  shopKey: string;
  fields: ProductFields;
}

export type BulkCsvParseResult =
  | { ok: false; message: string }
  | { ok: true; rows: BulkParsedRow[]; errors: string[]; keyColumn: 'license' | 'slug' };

/**
 * Parse a multi-shop product CSV. Same product columns as the single import,
 * plus a shop-key column — either `license` (matched to dispensaries.
 * license_number) or `slug` (matched to dispensaries.slug). The caller
 * resolves keys → ids and fills dispensary_id before upserting.
 */
export function parseBulkProductsCsv(csv: string, categoryMap: CategoryMap): BulkCsvParseResult {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { ok: false, message: 'Paste a CSV with a header row and at least one product row.' };
  }
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const ci = resolveCols(header);
  if (ci.name < 0 || ci.category < 0 || ci.price < 0) {
    return { ok: false, message: 'CSV must include "name", "category", and "price" columns.' };
  }
  // Accept either a license or slug column as the shop key.
  const licenseCol = header.indexOf('license') >= 0 ? header.indexOf('license') : header.indexOf('license_number');
  const slugCol = header.indexOf('slug') >= 0 ? header.indexOf('slug') : header.indexOf('dispensary_slug');
  const keyColumn: 'license' | 'slug' | null =
    licenseCol >= 0 ? 'license' : slugCol >= 0 ? 'slug' : null;
  const keyCol = keyColumn === 'license' ? licenseCol : slugCol;
  if (keyColumn === null) {
    return { ok: false, message: 'Bulk CSV must include a "license" or "slug" column to match each shop.' };
  }

  const rows: BulkParsedRow[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const shopKey = (cells[keyCol] ?? '').trim();
    if (!shopKey) {
      errors.push(`Row ${i}: missing ${keyColumn}`);
      continue;
    }
    const built = buildRow(cells, ci, categoryMap, i);
    if ('error' in built) errors.push(built.error);
    else rows.push({ shopKey, fields: built.fields });
  }
  return { ok: true, rows, errors, keyColumn };
}
