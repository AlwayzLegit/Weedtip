'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  brandClaimSubmittedEmail,
  brandCreatedEmail,
  SALES_INBOX,
  sendEmail,
} from '@/lib/email';
import { canUseBrandFeature } from '@/lib/brand-plan';
import { type FormState, formError, formSuccess, fromZodError, str } from '@/lib/forms';
import { notifyAdmins } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * http(s)-only website URL — blocks stored-XSS vectors like `javascript:`
 * landing in the public page's `href`. Bare domains get https:// prepended.
 * Returns '' for unset, null for invalid.
 */
function safeWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

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
  const website = safeWebsite(parsed.data.website ?? '');
  if (website === null) {
    return { status: 'error', message: 'Please fix the highlighted fields.', fieldErrors: { website: 'Enter a valid http(s) website URL.' } };
  }

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
    website: website || null,
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
  await notifyAdmins({
    type: 'brand_pending',
    title: 'New brand awaiting review',
    body: `${parsed.data.name} was submitted and needs approval.`,
    href: '/admin/brands',
  });

  revalidatePath('/studio');
  revalidatePath('/brands');
  return formSuccess('Brand submitted — it goes live after a quick review. You can set it up now.');
}

/** Brand owner edits their brand's presentation fields (via SECURITY DEFINER RPC). */
export async function updateOwnedBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const brandId = str(fd, 'brand_id');
  if (!brandId) return formError('Missing brand.');

  const supabase = await createClient();

  // Description + website are a Basic-tier feature ("complete profile"); logo is
  // free. The RPC overwrites, so a free brand's save must PRESERVE the stored
  // rich fields rather than blank them (the free form doesn't render them).
  let description = str(fd, 'description') ?? '';
  const safeSite = safeWebsite(str(fd, 'website') ?? '');
  if (safeSite === null) {
    return { status: 'error', message: 'Please fix the highlighted fields.', fieldErrors: { website: 'Enter a valid http(s) website URL.' } };
  }
  let website = safeSite;
  if (!(await canUseBrandFeature(brandId, 'brand_complete_profile'))) {
    const { data: cur } = await supabase
      .from('brands')
      .select('description, website')
      .eq('id', brandId)
      .maybeSingle();
    description = cur?.description ?? '';
    website = cur?.website ?? '';
  }

  // Cover is a free identity basic (like the dispensary cover). Three states:
  // field absent → omit the param (RPC keeps the stored banner, deploy-overlap
  // safety); present but empty → pass '' (RPC nullifs → banner CLEARED, so the
  // ImagePicker's "Remove image" actually sticks); present with value → set.
  const coverField = fd.get('cover_image_url');
  const { error } = await supabase.rpc('update_owned_brand', {
    p_brand_id: brandId,
    p_description: description,
    p_logo_url: str(fd, 'logo_url') ?? '',
    p_website: website,
    ...(typeof coverField === 'string' ? { p_cover_image_url: coverField.trim() } : {}),
  });
  if (error) return formError(error.message);

  revalidatePath('/dashboard/brands');
  revalidatePath('/brands');
  return formSuccess('Saved.');
}
