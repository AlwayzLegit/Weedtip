/**
 * Domain constants — the single source of truth for enum values shared across
 * web, mobile, and the database. These string literals MUST stay in sync with the
 * Postgres enum types defined in `packages/supabase/migrations`.
 */

// ─── User roles ──────────────────────────────────────────────────────────────
export const USER_ROLES = ['consumer', 'dispensary_owner', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ─── Dispensary lifecycle status ─────────────────────────────────────────────
export const DISPENSARY_STATUSES = ['pending', 'active', 'suspended'] as const;
export type DispensaryStatus = (typeof DISPENSARY_STATUSES)[number];

// ─── Cannabis strain types ───────────────────────────────────────────────────
export const STRAIN_TYPES = ['indica', 'sativa', 'hybrid', 'cbd'] as const;
export type StrainType = (typeof STRAIN_TYPES)[number];

// ─── Deal discount types ─────────────────────────────────────────────────────
export const DISCOUNT_TYPES = ['percentage', 'fixed', 'bogo'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

// ─── Order lifecycle status ──────────────────────────────────────────────────
export const ORDER_STATUSES = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ─── Order fulfilment type ───────────────────────────────────────────────────
export const ORDER_TYPES = ['pickup', 'delivery'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

// ─── Product categories (seed data — see migrations) ─────────────────────────
export interface CategorySeed {
  name: string;
  slug: string;
  icon: string;
  sortOrder: number;
}

export const PRODUCT_CATEGORIES: readonly CategorySeed[] = [
  { name: 'Flower', slug: 'flower', icon: 'cannabis', sortOrder: 10 },
  { name: 'Pre-rolls', slug: 'pre-rolls', icon: 'joint', sortOrder: 20 },
  { name: 'Vapes', slug: 'vapes', icon: 'vape', sortOrder: 30 },
  { name: 'Edibles', slug: 'edibles', icon: 'cookie', sortOrder: 40 },
  { name: 'Concentrates', slug: 'concentrates', icon: 'droplet', sortOrder: 50 },
  { name: 'Topicals', slug: 'topicals', icon: 'hand', sortOrder: 60 },
  { name: 'Tinctures', slug: 'tinctures', icon: 'pipette', sortOrder: 70 },
  { name: 'Accessories', slug: 'accessories', icon: 'package', sortOrder: 80 },
] as const;

// ─── Compliance ──────────────────────────────────────────────────────────────
/** Federal/most-state minimum age for recreational cannabis purchase. */
export const DEFAULT_MIN_AGE = 21;

// ─── Orders ──────────────────────────────────────────────────────────────────
/**
 * Fallback estimated tax rate, used only until the per-state rate loads (or if a
 * state has no operating_regions row). The authoritative rate lives on
 * operating_regions.tax_rate and is what create_order / create_pos_order charge —
 * clients should read it via the checkout_rules() RPC.
 */
export const ESTIMATED_TAX_RATE = 0.15;

// ─── Search / geo defaults ───────────────────────────────────────────────────
export const SEARCH_DEFAULTS = {
  /** Default search radius in meters (~25 miles). */
  radiusMeters: 40_000,
  /** Maximum allowed search radius in meters (~100 miles). */
  maxRadiusMeters: 160_000,
  /** Default page size for paginated results. */
  pageSize: 20,
  /** Maximum page size a client may request. */
  maxPageSize: 100,
} as const;

export const METERS_PER_MILE = 1609.344;
