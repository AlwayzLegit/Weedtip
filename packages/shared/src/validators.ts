/**
 * Zod validators — runtime validation for API inputs, form submissions, and Edge
 * Function payloads. Shared across web and mobile (via codegen) so client and server
 * agree on the same rules. Enum schemas are built from the constants in `constants.ts`.
 */
import { z } from 'zod';
import {
  DISCOUNT_TYPES,
  DISPENSARY_STATUSES,
  ORDER_STATUSES,
  ORDER_TYPES,
  SEARCH_DEFAULTS,
  STRAIN_TYPES,
  USER_ROLES,
} from './constants';

// ─── Primitive / shared schemas ──────────────────────────────────────────────
export const userRoleSchema = z.enum(USER_ROLES);
export const dispensaryStatusSchema = z.enum(DISPENSARY_STATUSES);
export const strainTypeSchema = z.enum(STRAIN_TYPES);
export const discountTypeSchema = z.enum(DISCOUNT_TYPES);
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const orderTypeSchema = z.enum(ORDER_TYPES);

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphen-separated slug');

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

export const coordinatesSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

/** Day-of-week operating hours. `null` for a day means closed. Times are "HH:mm" (24h). */
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm (24h)');
const dayHoursSchema = z.object({ open: timeSchema, close: timeSchema }).nullable();

export const operatingHoursSchema = z.object({
  mon: dayHoursSchema,
  tue: dayHoursSchema,
  wed: dayHoursSchema,
  thu: dayHoursSchema,
  fri: dayHoursSchema,
  sat: dayHoursSchema,
  sun: dayHoursSchema,
});
export type OperatingHours = z.infer<typeof operatingHoursSchema>;

/**
 * A date-specific hours override (holiday / special hours). Either the shop is
 * closed that day, or it has custom open/close times. `note` is an optional
 * short label (e.g. "Christmas Eve").
 */
export const specialHourSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
    closed: z.boolean().default(false),
    open: timeSchema.optional(),
    close: timeSchema.optional(),
    note: z.string().max(60).optional(),
  })
  .refine((s) => s.closed || (!!s.open && !!s.close), {
    message: 'Set open and close times, or mark the day closed',
    path: ['open'],
  });
export const specialHoursSchema = z.array(specialHourSchema).max(60);
export type SpecialHour = z.infer<typeof specialHourSchema>;

// ─── Profile ─────────────────────────────────────────────────────────────────
export const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(80).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  date_of_birth: z.string().date().nullable().optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ─── Dispensary ──────────────────────────────────────────────────────────────

/**
 * Curated amenity tags a dispensary can advertise on its listing (Weedmaps-style).
 * Stored as a `text[]`; the canonical set is enforced here so the menu of choices
 * stays consistent across web and mobile.
 */
export const AMENITIES = [
  // General
  'atm',
  'accessible',
  'curbside_pickup',
  'drive_thru',
  'parking',
  'security',
  'storefront',
  'pet_friendly',
  'restroom',
  'photo_id_required',
  // Payments
  'cash_only',
  'credit_cards',
  'debit_cards',
  'mobile_payment',
  'online_ordering',
  // Accessibility
  'wheelchair_accessible',
  // Discounts
  'veteran_discount',
  'senior_discount',
  'first_time_discount',
  'student_discount',
  'military_discount',
  'industry_discount',
  // Ownership / identity
  'woman_owned',
  'black_owned',
  'lgbtq_owned',
  'veteran_owned',
  'latino_owned',
  'asian_owned',
  'indigenous_owned',
] as const;
export type Amenity = (typeof AMENITIES)[number];

export const AMENITY_LABELS: Record<Amenity, string> = {
  atm: 'ATM',
  accessible: 'ADA accessible',
  curbside_pickup: 'Curbside pickup',
  drive_thru: 'Drive-thru',
  parking: 'Parking',
  security: 'Security on site',
  storefront: 'Storefront',
  pet_friendly: 'Pet friendly',
  restroom: 'Restroom',
  photo_id_required: 'Photo ID required',
  cash_only: 'Cash only',
  credit_cards: 'Credit cards',
  debit_cards: 'Debit cards',
  mobile_payment: 'Mobile / online payment',
  online_ordering: 'Online ordering',
  wheelchair_accessible: 'Wheelchair accessible',
  veteran_discount: 'Veteran discount',
  senior_discount: 'Senior discount',
  first_time_discount: 'First-time discount',
  student_discount: 'Student discount',
  military_discount: 'Military discount',
  industry_discount: 'Industry discount',
  woman_owned: 'Woman owned',
  black_owned: 'Black owned',
  lgbtq_owned: 'LGBTQ+ owned',
  veteran_owned: 'Veteran owned',
  latino_owned: 'Latino owned',
  asian_owned: 'Asian owned',
  indigenous_owned: 'Indigenous owned',
};

/** Grouped facets for the listing form, finder filters, and storefront display. */
export const AMENITY_GROUPS: { label: string; items: Amenity[] }[] = [
  {
    label: 'Ownership',
    items: [
      'woman_owned',
      'black_owned',
      'lgbtq_owned',
      'veteran_owned',
      'latino_owned',
      'asian_owned',
      'indigenous_owned',
    ],
  },
  { label: 'Accessibility', items: ['wheelchair_accessible', 'accessible', 'restroom'] },
  {
    label: 'Payments',
    items: ['cash_only', 'credit_cards', 'debit_cards', 'mobile_payment', 'online_ordering'],
  },
  {
    label: 'Discounts',
    items: [
      'veteran_discount',
      'senior_discount',
      'student_discount',
      'military_discount',
      'first_time_discount',
      'industry_discount',
    ],
  },
  {
    label: 'Amenities',
    items: [
      'atm',
      'parking',
      'security',
      'storefront',
      'curbside_pickup',
      'drive_thru',
      'pet_friendly',
      'photo_id_required',
    ],
  },
];

const amenitySchema = z.enum(AMENITIES);

export const dispensaryWriteSchema = z.object({
  name: z.string().min(2).max(120),
  slug: slugSchema,
  description: z.string().max(5000).nullable().optional(),
  // Address, ZIP, and coordinates are validated only when provided. Thousands of
  // registry-sourced listings lack a street address or geocode; hard-requiring
  // them locked their owners out of saving ANY edit (hours, phone, etc.) after
  // claiming. State stays required — every row has one.
  address: z.string().min(3).max(200).nullable().optional(),
  city: z.string().min(1).max(100).nullable().optional(),
  state: z.string().length(2, 'Use the 2-letter state code'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().url().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  license_number: z.string().max(80).nullable().optional(),
  is_medical: z.boolean().default(false),
  is_recreational: z.boolean().default(true),
  is_delivery: z.boolean().default(false),
  is_pickup: z.boolean().default(true),
  hours: operatingHoursSchema.nullable().optional(),
  announcement: z.string().max(500).nullable().optional(),
  amenities: z.array(amenitySchema).max(AMENITIES.length).default([]),
  require_id: z.boolean().default(false),
  post_order_message: z.string().max(250).nullable().optional(),
  video_url: z.string().url().max(300).nullable().optional(),
  gallery_urls: z.array(z.string().url()).max(12).default([]),
  special_hours: specialHoursSchema.default([]),
  location: coordinatesSchema.nullable().optional(),
});
export type DispensaryWriteInput = z.infer<typeof dispensaryWriteSchema>;

// ─── Product ─────────────────────────────────────────────────────────────────
export const productWriteSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1).max(160),
  slug: slugSchema,
  brand: z.string().max(120).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  image_urls: z.array(z.string().url()).max(10).default([]),
  strain_id: z.string().uuid().nullable().optional(),
  brand_id: z.string().uuid().nullable().optional(),
  strain_type: strainTypeSchema.nullable().optional(),
  thc_percentage: z.number().min(0).max(100).nullable().optional(),
  cbd_percentage: z.number().min(0).max(100).nullable().optional(),
  price_cents: z.number().int().nonnegative(),
  weight_grams: z.number().positive().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  barcode: z.string().max(64).nullable().optional(),
  stock_qty: z.number().int().min(0).max(1_000_000).nullable().optional(),
  in_stock: z.boolean().default(true),
  is_featured: z.boolean().default(false),
});
export type ProductWriteInput = z.infer<typeof productWriteSchema>;

// ─── Deal ────────────────────────────────────────────────────────────────────
/** Promo code: letters, digits, dashes; stored uppercased. Empty → no code. */
export const promoCodeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers, and dashes only')
  .transform((s) => s.toUpperCase());

export const dealWriteSchema = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().max(2000).nullable().optional(),
    image_url: z.string().url().nullable().optional(),
    code: promoCodeSchema.nullable().optional(),
    discount_type: discountTypeSchema,
    discount_value: z.number().nonnegative(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    is_active: z.boolean().default(true),
    /** Who may redeem a code deal. */
    audience: z.enum(['all', 'first_time', 'return']).default('all'),
    /** Redemption caps (reuse the deals table's per_customer_limit / total_limit). */
    per_customer_limit: z.number().int().positive().max(1_000_000).nullable().optional(),
    total_limit: z.number().int().positive().max(10_000_000).nullable().optional(),
  })
  .refine((d) => new Date(d.end_date) > new Date(d.start_date), {
    message: 'end_date must be after start_date',
    path: ['end_date'],
  })
  .refine((d) => d.discount_type !== 'percentage' || d.discount_value <= 100, {
    message: 'Percentage discount cannot exceed 100',
    path: ['discount_value'],
  });
export type DealWriteInput = z.infer<typeof dealWriteSchema>;

// ─── Review ──────────────────────────────────────────────────────────────────
export const reviewWriteSchema = z.object({
  dispensary_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(4000).nullable().optional(),
});
export type ReviewWriteInput = z.infer<typeof reviewWriteSchema>;

// ─── Order ───────────────────────────────────────────────────────────────────
export const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price_cents: z.number().int().nonnegative(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

/** Where a delivery order goes. Mirrors create_order's server-side sanitizer. */
export const deliveryAddressSchema = z.object({
  street: z.string().trim().min(3, 'Enter a street address.').max(120),
  unit: z.string().trim().max(40).optional(),
  city: z.string().trim().min(2, 'Enter a city.').max(80),
  state: z.string().trim().length(2, 'Use the 2-letter state code.'),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code.'),
  phone: z.string().trim().min(7, 'Enter a phone number for the driver.').max(20),
});
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

export const orderCreateSchema = z.object({
  dispensary_id: z.string().uuid(),
  order_type: orderTypeSchema,
  items: z.array(orderItemSchema).min(1),
  notes: z.string().max(1000).nullable().optional(),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

// ─── Search ──────────────────────────────────────────────────────────────────
/**
 * Dispensary search parameters. This is the stable contract the frontend depends on.
 * The current implementation is Postgres FTS + PostGIS; swapping in Typesense/Meilisearch
 * later must satisfy this same input/output shape — keep it backend-agnostic.
 */
export const dispensarySearchSchema = z.object({
  query: z.string().max(120).optional(),
  lat: latitudeSchema.optional(),
  lng: longitudeSchema.optional(),
  radius_meters: z
    .number()
    .positive()
    .max(SEARCH_DEFAULTS.maxRadiusMeters)
    .default(SEARCH_DEFAULTS.radiusMeters),
  is_delivery: z.boolean().optional(),
  is_pickup: z.boolean().optional(),
  is_medical: z.boolean().optional(),
  is_recreational: z.boolean().optional(),
  open_now: z.boolean().optional(),
  category_slug: slugSchema.optional(),
  amenities: z.array(amenitySchema).max(AMENITIES.length).optional(),
  page: z.number().int().nonnegative().default(0),
  page_size: z
    .number()
    .int()
    .positive()
    .max(SEARCH_DEFAULTS.maxPageSize)
    .default(SEARCH_DEFAULTS.pageSize),
});
export type DispensarySearchParams = z.infer<typeof dispensarySearchSchema>;

export const dispensarySortSchema = z.enum(['default', 'rating', 'reviewed', 'distance', 'name']);
export type DispensarySort = z.infer<typeof dispensarySortSchema>;

/**
 * Bounding-box variant used by the map-first finder: the viewport is the query.
 * `origin` is independent of the bounds — when the visitor shared their
 * location, distance stays available while they pan the map elsewhere.
 */
export const dispensaryBoundsSearchSchema = z.object({
  min_lat: latitudeSchema,
  min_lng: longitudeSchema,
  max_lat: latitudeSchema,
  max_lng: longitudeSchema,
  query: z.string().max(120).optional(),
  is_delivery: z.boolean().optional(),
  is_pickup: z.boolean().optional(),
  is_medical: z.boolean().optional(),
  is_recreational: z.boolean().optional(),
  open_now: z.boolean().optional(),
  has_deals: z.boolean().optional(),
  category_slug: slugSchema.optional(),
  amenities: z.array(amenitySchema).max(AMENITIES.length).optional(),
  origin_lat: latitudeSchema.optional(),
  origin_lng: longitudeSchema.optional(),
  sort: dispensarySortSchema.default('default'),
  limit: z.number().int().positive().max(200).default(100),
  offset: z.number().int().nonnegative().default(0),
});
export type DispensaryBoundsSearchParams = z.infer<typeof dispensaryBoundsSearchSchema>;

export const productSearchSchema = z.object({
  query: z.string().max(120).optional(),
  category_slug: slugSchema.optional(),
  strain_type: strainTypeSchema.optional(),
  dispensary_id: z.string().uuid().optional(),
  min_price_cents: z.number().int().nonnegative().optional(),
  max_price_cents: z.number().int().nonnegative().optional(),
  in_stock_only: z.boolean().default(true),
  page: z.number().int().nonnegative().default(0),
  page_size: z
    .number()
    .int()
    .positive()
    .max(SEARCH_DEFAULTS.maxPageSize)
    .default(SEARCH_DEFAULTS.pageSize),
});
export type ProductSearchParams = z.infer<typeof productSearchSchema>;

// ─── Age verification (compliance) ───────────────────────────────────────────
export const ageVerifySchema = z.object({
  date_of_birth: z.string().date(),
});
export type AgeVerifyInput = z.infer<typeof ageVerifySchema>;
