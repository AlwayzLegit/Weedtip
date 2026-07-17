import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * One-click CAN-SPAM unsubscribe for claim-invite emails. Token-keyed; the
 * RPC suppresses every invite sharing the address. Returns a plain
 * confirmation page — no sign-in, no extra steps.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  let ok = false;
  if (token) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('claim_invite_unsubscribe', { p_token: token });
    ok = data === true;
  }
  const body = ok
    ? '<h1>You are unsubscribed</h1><p>You will not receive further emails about this listing.</p>'
    : '<h1>Link not recognized</h1><p>This unsubscribe link is invalid or already used. If you keep receiving email, reply to the message and we will remove you manually.</p>';
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weedtip</title></head><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#1a1a1a">${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
