import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { authEmail, sendEmail, type AuthEmailKind } from '@/lib/email';

export const runtime = 'nodejs';

/**
 * Supabase "Send Email" auth hook.
 *
 * When enabled in the Supabase dashboard (Authentication → Hooks → Send Email →
 * HTTPS, pointed at {SITE_URL}/api/auth/send-email with a shared secret),
 * Supabase delegates ALL auth emails (confirm signup, magic link, password
 * reset, invite, email change, reauthentication) to this endpoint instead of
 * sending its own unbranded templates. We render them on-brand via lib/email.ts
 * (same shell + DB-driven brand tokens as our transactional mail) and dispatch
 * through Resend.
 *
 * Payloads are signed with the Standard Webhooks scheme; we verify the HMAC
 * before trusting anything. Set SEND_EMAIL_HOOK_SECRET to the secret shown in
 * the dashboard (format: "v1,whsec_<base64>").
 */

type EmailData = {
  token?: string;
  token_hash?: string;
  redirect_to?: string;
  email_action_type?: string;
  site_url?: string;
  token_new?: string;
  token_hash_new?: string;
};
type HookPayload = { user?: { email?: string }; email_data?: EmailData };

/** Standard Webhooks HMAC verification. Returns true iff a signature matches. */
function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const sigHeader = headers.get('webhook-signature');
  if (!id || !timestamp || !sigHeader) return false;

  // Secret arrives as "v1,whsec_<base64>" (or "whsec_<base64>"); the key is the
  // base64 payload after the whsec_ prefix.
  const base64Secret = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  let key: Buffer;
  try {
    key = Buffer.from(base64Secret, 'base64');
  } catch {
    return false;
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');
  const expectedBuf = Buffer.from(expected);

  // Header is a space-delimited list of "v1,<sig>" entries; any match passes.
  return sigHeader.split(' ').some((entry) => {
    const sig = entry.includes(',') ? entry.split(',')[1] : entry;
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}

/** Map Supabase's email_action_type onto our branded template kind. */
function toKind(actionType: string | undefined): AuthEmailKind | null {
  switch (actionType) {
    case 'signup':
      return 'signup';
    case 'magiclink':
      return 'magiclink';
    case 'recovery':
      return 'recovery';
    case 'invite':
      return 'invite';
    case 'email_change':
    case 'email_change_new':
    case 'email_change_current':
      return 'email_change';
    case 'reauthentication':
      return 'reauthentication';
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error('[auth-email-hook] SEND_EMAIL_HOOK_SECRET not set');
    return NextResponse.json({ error: 'hook not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody) as HookPayload;
  } catch {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }

  const email = payload.user?.email;
  const data = payload.email_data;
  const kind = toKind(data?.email_action_type);
  if (!email || !data || !kind) {
    return NextResponse.json({ error: 'unsupported action' }, { status: 400 });
  }

  // Build the verification URL Supabase's default template would have used.
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  let url: string | undefined;
  if (data.token_hash && data.email_action_type && supabaseUrl) {
    const params = new URLSearchParams({
      token: data.token_hash,
      type: data.email_action_type,
    });
    if (data.redirect_to) params.set('redirect_to', data.redirect_to);
    url = `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
  }

  const message = authEmail(kind, { url, otp: data.token });
  const ok = await sendEmail({ to: email, subject: message.subject, html: message.html });
  if (!ok) {
    // Returning non-200 tells Supabase the send failed (it won't fall back).
    return NextResponse.json({ error: 'send failed' }, { status: 502 });
  }
  return NextResponse.json({});
}
