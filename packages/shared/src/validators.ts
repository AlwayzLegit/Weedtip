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

// ─── Profile ─────────────────────────────────────────────────────────────────
export const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(80).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  date_of_birth: z.string().date().nullable().optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ─── Dispensary ──────────────────────────────────────────────────────────────
export const dispensaryWriteSchema = z.object({
  name: z.string().min(2).max(120),
  slug: slugSchema,
  description: z.string().max(5000).nullable().optional(),
  address: z.string().min(3).max(200),
  city: z.string().min(1).max(100),
  state: z.string().length(2, 'Use the 2-letter state code'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
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
  location: coordinatesSchema,
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
  in_stock: z.boolean().default(true),
  is_featured: z.boolean().default(false),
});
export type ProductWriteInput = z.infer<typeof productWriteSchema>;

// ─── Deal ────────────────────────────────────────────────────────────────────
export const dealWriteSchema = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().max(2000).nullable().optional(),
    discount_type: discountTypeSchema,
    discount_value: z.number().nonnegative(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    is_active: z.boolean().default(true),
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
  page: z.number().int().nonnegative().default(0),
  page_size: z
    .number()
    .int()
    .positive()
    .max(SEARCH_DEFAULTS.maxPageSize)
    .default(SEARCH_DEFAULTS.pageSize),
});
export type DispensarySearchParams = z.infer<typeof dispensarySearchSchema>;

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
