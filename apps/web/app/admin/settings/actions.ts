'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { formError, formSuccess, fromZodError, str, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

const settingsSchema = z.object({
  brand_name: z.string().trim().min(1, 'Brand name is required').max(80),
  legal_name: z.string().trim().max(120).nullable(),
  tagline: z.string().trim().max(160).nullable(),
  support_email: z.string().trim().email().max(254),
  sales_email: z.string().trim().email().max(254),
  ads_email: z.string().trim().email().max(254),
  privacy_email: z.string().trim().email().max(254),
  email_from: z.string().trim().min(3).max(160),
  phone_display: z.string().trim().max(40).nullable(),
  phone_e164: z
    .string()
    .trim()
    .max(20)
    .regex(/^\+?[0-9]{7,15}$/, 'Use E.164 digits, e.g. +17472504446')
    .nullable()
    .or(z.literal('').transform(() => null)),
  address_line: z.string().trim().max(200).nullable(),
  address_locality: z.string().trim().max(120).nullable(),
  address_region: z.string().trim().max(60).nullable(),
  postal_code: z.string().trim().max(20).nullable(),
  country: z.string().trim().min(2).max(2),
  brand_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #1a7f4e'),
});

/** Admin edits the single-row platform_settings (brand + contact source of truth). */
export async function updatePlatformSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const nn = (k: string) => {
    const v = str(fd, k);
    return v && v.trim() ? v.trim() : null;
  };
  const parsed = settingsSchema.safeParse({
    brand_name: str(fd, 'brand_name') ?? '',
    legal_name: nn('legal_name'),
    tagline: nn('tagline'),
    support_email: str(fd, 'support_email') ?? '',
    sales_email: str(fd, 'sales_email') ?? '',
    ads_email: str(fd, 'ads_email') ?? '',
    privacy_email: str(fd, 'privacy_email') ?? '',
    email_from: str(fd, 'email_from') ?? '',
    phone_display: nn('phone_display'),
    phone_e164: nn('phone_e164'),
    address_line: nn('address_line'),
    address_locality: nn('address_locality'),
    address_region: nn('address_region'),
    postal_code: nn('postal_code'),
    country: (str(fd, 'country') ?? 'US').toUpperCase(),
    brand_color: str(fd, 'brand_color') ?? '',
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  // RLS (platform_settings_write_admin) enforces admin-only.
  const { error } = await supabase
    .from('platform_settings')
    .update(parsed.data)
    .eq('id', 1);
  if (error) return formError(error.message);

  // Brand facts render sitewide (footer, JSON-LD, emails) — refresh everything.
  revalidatePath('/', 'layout');
  return formSuccess('Settings saved.');
}

/**
 * Set or clear the Anthropic API key in platform_secrets — the super-admin
 * switch for AI review summaries. Admin-only via RLS; the value is never
 * echoed back to any client. Clearing the key hides every AI surface again.
 */
export async function saveAnthropicKey(_prev: FormState, fd: FormData): Promise<FormState> {
  const value = (str(fd, 'anthropic_key') ?? '').trim();
  const supabase = await createClient();

  if (!value) {
    const { error } = await supabase.from('platform_secrets').delete().eq('name', 'anthropic_api_key');
    if (error) return formError(error.message);
    revalidatePath('/admin/settings');
    return formSuccess('Anthropic key cleared — AI review summaries are now hidden site-wide.');
  }

  if (!/^sk-ant-/.test(value)) {
    return formError('That does not look like an Anthropic API key (they start with sk-ant-).');
  }
  const { error } = await supabase.from('platform_secrets').upsert(
    { name: 'anthropic_api_key', value, updated_at: new Date().toISOString() },
    { onConflict: 'name' },
  );
  if (error) return formError(error.message);
  revalidatePath('/admin/settings');
  return formSuccess('Anthropic key saved — AI review summaries are now active.');
}
