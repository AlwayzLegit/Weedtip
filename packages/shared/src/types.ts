/**
 * Domain types — the application-level shape of core entities, independent of the
 * database row representation (which lives in `@weedtip/supabase` as generated types).
 * Use these in UI and business logic; map DB rows into these at the data-access boundary.
 */
import type {
  DiscountType,
  DispensaryStatus,
  OrderStatus,
  OrderType,
  StrainType,
  UserRole,
} from './constants';
import type { Coordinates, OperatingHours, OrderItem } from './validators';

export interface Profile {
  id: string;
  role: UserRole;
  displayName: string | null;
  avatarUrl: string | null;
  dateOfBirth: string | null; // ISO date (YYYY-MM-DD)
  createdAt: string;
  updatedAt: string;
}

export interface Dispensary {
  id: string;
  ownerId: string | null;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  licenseNumber: string | null;
  isMedical: boolean;
  isRecreational: boolean;
  isDelivery: boolean;
  isPickup: boolean;
  hours: OperatingHours | null;
  location: Coordinates;
  status: DispensaryStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
}

export interface Product {
  id: string;
  dispensaryId: string;
  categoryId: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  imageUrls: string[];
  strainType: StrainType | null;
  thcPercentage: number | null;
  cbdPercentage: number | null;
  priceCents: number;
  weightGrams: number | null;
  unit: string | null;
  inStock: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  dispensaryId: string;
  title: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Review {
  id: string;
  dispensaryId: string;
  userId: string;
  rating: number;
  body: string | null;
  createdAt: string;
}

export interface Favorite {
  userId: string;
  dispensaryId: string;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  dispensaryId: string;
  status: OrderStatus;
  orderType: OrderType;
  items: OrderItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperatingRegion {
  state: string;
  isMedicalLegal: boolean;
  isRecreationalLegal: boolean;
  minAge: number;
  notes: string | null;
}

// ─── Search results ──────────────────────────────────────────────────────────
/** A dispensary search hit enriched with the geo distance from the query point. */
export interface DispensarySearchResult extends Dispensary {
  /** Distance from the search origin, in meters. Null when no origin was provided. */
  distanceMeters: number | null;
  /** Whether the dispensary is currently open, per its `hours`. */
  isOpenNow: boolean;
  /** Full-text relevance rank (higher is more relevant). */
  rank: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
