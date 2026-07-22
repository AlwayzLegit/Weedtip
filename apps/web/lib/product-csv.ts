import type { Database } from '@weedtip/supabase';
import { slugify } from '@/lib/utils';

export type ProductInsert = Database['public']['Tables']['products']['Insert'];

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

export type CsvParseResult =
  | { ok: false; message: string }
  | { ok: true; rows: ProductInsert[]; errors: string[] };

/**
 * Parse a pasted product CSV into product upsert rows for a target
 * dispensary. Shared by the owner self-import and admin menu-seeding so both
 * accept exactly the same format (name/category/price required; brand,
 * strain_type, thc, cbd, unit, description, in_stock optional). Rows upsert by
 * (dispensary_id, slug).
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
  const idx = (name: string) => header.indexOf(name);
  const ci = {
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
  if (ci.name < 0 || ci.category < 0 || ci.price < 0) {
    return { ok: false, message: 'CSV must include at least "name", "category", and "price" columns.' };
  }

  const rows: ProductInsert[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const get = (col: number) => (col >= 0 ? (cells[col] ?? '').trim() : '');

    const name = get(ci.name);
    if (!name) {
      errors.push(`Row ${i}: missing name`);
      continue;
    }
    const categoryId = categoryMap.get(get(ci.category).toLowerCase());
    if (!categoryId) {
      errors.push(`Row ${i} (${name}): unknown category "${get(ci.category)}"`);
      continue;
    }
    const price = Number(get(ci.price));
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Row ${i} (${name}): invalid price`);
      continue;
    }
    const strain = get(ci.strain).toLowerCase();
    const thc = Number(get(ci.thc));
    const cbd = Number(get(ci.cbd));
    const inStock = get(ci.inStock).toLowerCase();

    rows.push({
      dispensary_id: dispensaryId,
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
    });
  }

  return { ok: true, rows, errors };
}
