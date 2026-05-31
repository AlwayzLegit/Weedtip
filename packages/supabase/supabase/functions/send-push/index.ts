// ════════════════════════════════════════════════════════════════════════════
// Edge Function: send-push  (server-to-server — invoke with the service role key)
//
// The native-push last mile. Given { user_id, title, body, data }, it looks up the
// user's registered device tokens and delivers an FCM push. Intended to be called
// from a DB webhook / trigger (pg_net) when a `notifications` row is inserted, or
// from trusted backend code.
//
// REQUIRES env FCM_SERVER_KEY to actually send. Without it the function is a safe
// no-op (returns sent:0) so the whole pipeline is deployable before Firebase is set
// up. NOTE: FCM legacy HTTP is used here for brevity; production should migrate to
// FCM HTTP v1 (OAuth via a service account).
// ════════════════════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface Payload {
  user_id: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!payload.user_id || !payload.title) {
    return json({ error: 'user_id and title are required' }, 400);
  }

  // Service-role client — reads device_tokens across users (trusted context).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: tokens, error } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', payload.user_id);

  if (error) return json({ error: error.message }, 400);
  const deviceTokens = (tokens ?? []).map((t: { token: string }) => t.token);

  const fcmKey = Deno.env.get('FCM_SERVER_KEY');
  if (!fcmKey) {
    // Pipeline works end-to-end; native delivery is just not configured yet.
    return json({
      sent: 0,
      tokens: deviceTokens.length,
      note: 'FCM_SERVER_KEY not set — skipping native delivery (configure Firebase to enable).',
    });
  }

  let sent = 0;
  for (const token of deviceTokens) {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${fcmKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        notification: { title: payload.title, body: payload.body ?? '' },
        data: payload.data ?? {},
      }),
    });
    if (res.ok) sent++;
  }

  return json({ sent, tokens: deviceTokens.length });
});
