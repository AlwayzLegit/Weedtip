'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  brandClaimSubmittedEmail,
  brandCreatedEmail,
  SALES_INBOX,
  sendEmail,
} from '@/lib/email';
import { type FormState, formError, formSuccess, fromZodError, str } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const claimSchema = z.object({
  brand_id: z.string().uuid(),
  business_email: z.string().email('Enter a valid business email').max(254),
  message: z.string().max(2000).nullable(),
});

/** A signed-in user requests ownership of an existing (unclaimed) brand. */
export async function requestBrandClaim(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const parsed = claimSchema.safeParse({
    brand_id: str(fd, 'brand_id') ?? '',
    business_email: str(fd, 'business_email') ?? '',
    message: str(fd, 'message') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return formError('Please sign in to claim a brand.');

  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .eq('id', parsed.data.brand_id)
    .maybeSingle();

  const { error } = await supabase.from('brand_claims').insert({
    brand_id: parsed.data.brand_id,
    user_id: user.id,
    business_email: parsed.data.business_email,
    message: parsed.data.message,
  });
  if (error) {
    return formError(
      error.code === '23505' ? 'You already requested this brand.' : error.message,
    );
  }

  // Best-effort notifications: claimant ack + heads-up to the team inbox.
  if (brand?.name) {
    const ack = brandClaimSubmittedEmail(brand.name);
    await sendEmail({ to: parsed.data.business_email, subject: ack.subject, html: ack.html });
    await sendEmail({
      to: SALES_INBOX,
      subject: `[Brand claims] ${brand.name}`,
      html: `<p>${parsed.data.business_email} claimed <strong>${brand.name}</strong>. Review in /admin/claims.</p>`,
    });
  }

  revalidatePath('/brand');
  return formSuccess('Claim submitted — an admin will review it shortly.');
}

const createSchema = z.object({
  name: z.string().min(2, 'Brand name is required').max(80),
  website: z.string().max(200).nullable(),
  description: z.string().max(2000).nullable(),
});

/**
 * Self-serve brand creation. Any signed-in user can create a brand they own; it
 * starts `pending` and goes live after admin review (RLS enforces owner + pending
 * on insert). Mirrors the dispensary create-a-listing flow.
 */
export async function createBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = createSchema.safeParse({
    name: str(fd, 'name') ?? '',
    website: str(fd, 'website') ?? null,
    description: str(fd, 'description') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return formError('Please sign in to create a brand.');

  // Unique slug: base off the name, disambiguate with a short suffix on collision.
  const base = slugify(parsed.data.name) || 'brand';
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const { data: taken } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${Math.floor(1000 + (Date.now() % 9000))}`.slice(0, 80);
  }

  const { error } = await supabase.from('brands').insert({
    name: parsed.data.name,
    slug,
    website: parsed.data.website,
    description: parsed.data.description,
    owner_id: user.id,
    status: 'pending',
  });
  if (error) {
    return formError(
      error.code === '23505'
        ? 'A brand with that name already exists — try claiming it instead.'
        : error.message,
    );
  }

  // Heads-up to the team so the brand can be reviewed and activated.
  const m = brandCreatedEmail(parsed.data.name, user.email ?? 'A user', siteUrl());
  await sendEmail({ to: SALES_INBOX, subject: m.subject, html: m.html });

  revalidatePath('/studio');
  revalidatePath('/brands');
  return formSuccess('Brand submitted — it goes live after a quick review. You can set it up now.');
}

/** Brand owner edits their brand's presentation fields (via SECURITY DEFINER RPC). */
export async function updateOwnedBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const brandId = str(fd, 'brand_id');
  if (!brandId) return formError('Missing brand.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_owned_brand', {
    p_brand_id: brandId,
    p_description: str(fd, 'description') ?? '',
    p_logo_url: str(fd, 'logo_url') ?? '',
    p_website: str(fd, 'website') ?? '',
  });
  if (error) return formError(error.message);

  revalidatePath('/dashboard/brands');
  revalidatePath('/brands');
  return formSuccess('Saved.');
}
