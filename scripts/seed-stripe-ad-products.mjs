#!/usr/bin/env node
/**
 * Seed Stripe Products/Prices for the regional ad system and write the price
 * ids back to ad_products. One Stripe Product per (slot_type, tier) — e.g.
 * "Featured — Tier A+" — with a monthly recurring Price at the LAUNCH price.
 * When launch pricing ratchets to list, create new Prices and re-run with
 * PRICE_FIELD=list_price.
 *
 * Idempotent: rows that already have stripe_price_id are skipped.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... \
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/seed-stripe-ad-products.mjs
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const { STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!STRIPE_SECRET_KEY || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Set STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const PRICE_FIELD = process.env.PRICE_FIELD === 'list_price' ? 'list_price' : 'launch_price';

const stripe = new Stripe(STRIPE_SECRET_KEY);
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TIER_LABEL = { A_PLUS: 'A+', A: 'A', B_PLUS: 'B+', B: 'B' };
const SLOT_LABEL = {
  exclusive: 'Exclusive Regional Sponsor',
  featured: 'Featured',
  premium: 'Premium Listing',
  standard: 'Standard Listing',
};

const { data: products, error } = await supabase
  .from('ad_products')
  .select('id, slot_type, tier, launch_price, list_price, stripe_price_id')
  .order('slot_type')
  .order('tier');
if (error) {
  console.error('Could not read ad_products:', error.message);
  process.exit(1);
}

let created = 0;
for (const p of products ?? []) {
  if (p.stripe_price_id) {
    console.log(`skip  ${p.slot_type}/${p.tier} — already has ${p.stripe_price_id}`);
    continue;
  }
  // Exclusive is negotiated per region and sold by hand; no self-serve price.
  if (p.slot_type === 'exclusive') {
    console.log(`skip  exclusive/${p.tier} — negotiated, not self-serve`);
    continue;
  }
  const name = `${SLOT_LABEL[p.slot_type]} — Tier ${TIER_LABEL[p.tier] ?? p.tier}`;
  const amount = p[PRICE_FIELD];

  const product = await stripe.products.create({
    name,
    metadata: { kind: 'ad_slot', slot_type: p.slot_type, tier: p.tier },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: amount,
    recurring: { interval: 'month' },
    metadata: { kind: 'ad_slot', slot_type: p.slot_type, tier: p.tier, basis: PRICE_FIELD },
  });

  const { error: upErr } = await supabase
    .from('ad_products')
    .update({ stripe_price_id: price.id })
    .eq('id', p.id);
  if (upErr) {
    console.error(`FAILED to write back ${p.slot_type}/${p.tier}:`, upErr.message);
    process.exit(1);
  }
  created += 1;
  console.log(`ok    ${name} → ${price.id} (${(amount / 100).toFixed(2)}/mo)`);
}

console.log(`Done. Created ${created} Stripe price(s).`);
