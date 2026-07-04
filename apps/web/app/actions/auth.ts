'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { USER_ROLES } from '@weedtip/shared';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { error?: string; message?: string };

const TOO_MANY = 'Too many attempts. Please wait a minute and try again.';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await rateLimit('auth-signin', { limit: 10, window: '60 s' })).success) {
    return { error: TOO_MANY };
  }
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  // Only honor internal, single-slash paths to prevent open-redirects.
  const next = formData.get('next');
  const dest = typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : '/';

  revalidatePath('/', 'layout');
  redirect(dest);
}

const signUpSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  display_name: z.string().min(1, 'Name is required').max(80),
  date_of_birth: z.string().date('Enter your date of birth'),
  // Only consumer or dispensary_owner can self-register.
  role: z.enum(USER_ROLES).refine((r) => r !== 'admin', 'Invalid role'),
});

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await rateLimit('auth-signup', { limit: 5, window: '60 s' })).success) {
    return { error: TOO_MANY };
  }
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    display_name: formData.get('display_name'),
    date_of_birth: formData.get('date_of_birth'),
    role: formData.get('role') ?? 'consumer',
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  // Compliance: enforce 21+ at the gate before creating the account.
  const age = ageInYears(parsed.data.date_of_birth);
  if (age < 21) {
    return { error: 'You must be 21 or older to use Weedtip.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      // Picked up by the handle_new_user trigger to seed the profile.
      data: {
        display_name: parsed.data.display_name,
        date_of_birth: parsed.data.date_of_birth,
        role: parsed.data.role,
      },
    },
  });
  if (error) return { error: error.message };

  // Email confirmation enabled → no session yet.
  if (!data.session) {
    return { message: 'Check your email to confirm your account, then sign in.' };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

const resetSchema = z.object({ email: z.string().email('Enter a valid email') });

export async function sendPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await rateLimit('auth-reset', { limit: 5, window: '60 s' })).success) {
    return { error: TOO_MANY };
  }
  const parsed = resetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/account/update-password`,
  });
  if (error) return { error: error.message };

  return { message: 'If that email exists, a reset link is on its way.' };
}

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

/**
 * Set a new password for the signed-in user. Reached from the reset-email link
 * (the callback exchanges the recovery code for a session, then lands here) or
 * from the account page for a routine change. Requires an active session.
 */
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await rateLimit('auth-update-password', { limit: 10, window: '60 s' })).success) {
    return { error: TOO_MANY };
  }
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Your reset link has expired. Request a new one and try again.' };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { message: 'Password updated. You can now use it to sign in.' };
}

function ageInYears(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}
