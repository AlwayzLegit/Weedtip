import { NextResponse, type NextRequest } from 'next/server';
import {
  sendEmail,
  welcomeBrandEmail,
  welcomeBusinessEmail,
  welcomeShopperEmail,
} from '@/lib/email';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth callback — exchanges the `code` (email confirmation, password reset,
 * OAuth) for a session. On a user's FIRST confirmation it sends a one-time
 * role-aware welcome email and routes them into the right first-run flow
 * (shopper → /welcome, dispensary owner → /claim, brand intent → /for-brands),
 * unless they arrived with an explicit `next` (e.g. the listing they came to
 * claim), which is always honored.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Only honor internal, single-slash paths to prevent open redirects.
  const nextParam = searchParams.get('next');
  const next = typeof nextParam === 'string' && /^\/(?!\/)/.test(nextParam) ? nextParam : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
  }

  // Password-recovery flow: no welcome, no first-run routing — go set the password.
  if (next.startsWith('/account/update-password')) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Brand accounts sign up as consumers but carry their intent in `next`.
  const brandIntent = next.startsWith('/for-brands') || next.startsWith('/brands');

  let dest = next;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, role, welcomed_at')
      .eq('id', user.id)
      .maybeSingle();

    // First confirmation: send the welcome once, then route into first-run.
    if (profile && !profile.welcomed_at) {
      await supabase
        .from('profiles')
        .update({ welcomed_at: new Date().toISOString() })
        .eq('id', user.id);

      if (user.email) {
        const name = profile.display_name;
        const m = brandIntent
          ? welcomeBrandEmail(name, origin)
          : profile.role === 'dispensary_owner'
            ? welcomeBusinessEmail(name, origin)
            : welcomeShopperEmail(name, origin);
        await sendEmail({ to: user.email, subject: m.subject, html: m.html });
      }

      // Only pick a default landing when they didn't arrive with a real target.
      if (next === '/') {
        dest = profile.role === 'dispensary_owner' ? '/get-started' : '/welcome';
      }
    }
  }

  return NextResponse.redirect(`${origin}${dest}`);
}
