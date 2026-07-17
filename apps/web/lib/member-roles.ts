/**
 * Team role matrix (P4). Client-safe (no server-only) so both the server gates
 * (lib/owner) and the client nav can share one capability model.
 *
 * 'owner' is the account holder (Admin) — not a member row. The other three are
 * invitable team roles with scoped capabilities.
 */
export type MemberRole = 'owner' | 'manager' | 'campaign_manager' | 'associate';

/** What a dashboard area needs. Owner has all; members get a scoped subset. */
export type Capability =
  | 'menu' // products
  | 'listing'
  | 'orders'
  | 'reviews'
  | 'marketing' // deals, promos, updates
  | 'analytics'
  | 'owner'; // billing, team, taxes, ad spend — owner only

const MEMBER_CAPS: Record<MemberRole, Capability[]> = {
  owner: ['menu', 'listing', 'orders', 'reviews', 'marketing', 'analytics', 'owner'],
  manager: ['menu', 'listing', 'orders', 'reviews', 'analytics'],
  campaign_manager: ['menu', 'marketing', 'analytics'],
  associate: ['menu'],
};

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Admin',
  manager: 'Manager',
  campaign_manager: 'Campaign manager',
  associate: 'Associate',
};

/** Invitable team roles (owner is the account holder, not invited). */
export const INVITABLE_ROLES = ['manager', 'campaign_manager', 'associate'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const MEMBER_ROLE_DESCRIPTION: Record<InvitableRole, string> = {
  manager: 'Runs the shop: listing, menu, orders, reviews, and analytics. No billing, team, or taxes.',
  campaign_manager: 'Runs marketing: deals, promos, updates, and analytics. No operations or billing.',
  associate: 'Menu only: add and edit products.',
};

export function memberCan(role: MemberRole, cap: Capability): boolean {
  return role === 'owner' || MEMBER_CAPS[role].includes(cap);
}

/** Normalize a stored dispensary_members.role into a MemberRole. */
export function toMemberRole(raw: string | null | undefined): MemberRole {
  return raw === 'manager' || raw === 'campaign_manager' ? raw : 'associate';
}
