import {
  Accessibility,
  Award,
  Banknote,
  Car,
  CircleParking,
  CreditCard,
  Dog,
  DoorOpen,
  IdCard,
  type LucideIcon,
  Percent,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Users,
} from 'lucide-react';
import type { Amenity } from '@weedtip/shared';

/**
 * Per-amenity icons for the storefront "Features & amenities" grid — the
 * cheap perceived-polish win over a wall of identical checkmarks. Ownership
 * badges share Users, discounts share Percent; the rest are specific.
 */
export const AMENITY_ICON: Record<Amenity, LucideIcon> = {
  atm: Banknote,
  accessible: Accessibility,
  curbside_pickup: Car,
  drive_thru: Car,
  parking: CircleParking,
  security: ShieldCheck,
  storefront: Store,
  pet_friendly: Dog,
  restroom: DoorOpen,
  photo_id_required: IdCard,
  cash_only: Banknote,
  credit_cards: CreditCard,
  debit_cards: CreditCard,
  mobile_payment: Smartphone,
  online_ordering: ShoppingBag,
  wheelchair_accessible: Accessibility,
  veteran_discount: Percent,
  senior_discount: Percent,
  first_time_discount: Percent,
  student_discount: Percent,
  military_discount: Percent,
  industry_discount: Percent,
  woman_owned: Users,
  black_owned: Users,
  lgbtq_owned: Award,
  veteran_owned: Award,
  latino_owned: Users,
  asian_owned: Users,
  indigenous_owned: Award,
};
