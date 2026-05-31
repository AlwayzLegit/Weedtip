// ════════════════════════════════════════════════════════════════════════════
// Edge Function: age-verify  (authenticated — verify_jwt = true)
//
// Compliance gate. Confirms the caller meets the minimum age for cannabis purchase.
// Age source precedence: a `date_of_birth` in the request body (e.g. submitted at the
// age gate) else the caller's stored `profiles.date_of_birth`. The minimum age is
// looked up per `state` from `operating_regions` (default 21).
//
// If a body `date_of_birth` is supplied and `persist` is true, it is written to the
// caller's profile (RLS permits self-update), so the age gate is a one-time step.
// ════════════════════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handlePreflight, jsonResponse } from '../_shared/cors.ts';

const DEFAULT_MIN_AGE = 21;

interface Body {
  date_of_birth?: string; // YYYY-MM-DD
  state?: string; // 2-letter code
  persist?: boolean;
}

/** Whole years between a date of birth and now (UTC). */
function ageInYears(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age;
}

function parseDob(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Expect strict YYYY-MM-DD.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return jsonResponse({ verified: false, error: 'Missing Authorization header' }, 401);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ verified: false, error: 'Not authenticated' }, 401);
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  // Resolve date of birth: body wins, else stored profile.
  let dob = parseDob(body.date_of_birth);
  if (!dob) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('date_of_birth')
      .eq('id', user.id)
      .maybeSingle();
    dob = parseDob(profile?.date_of_birth ?? null);
  }

  if (!dob) {
    return jsonResponse({ verified: false, reason: 'no_date_of_birth' }, 200);
  }

  // Resolve minimum age for the region (default 21).
  let minAge = DEFAULT_MIN_AGE;
  if (body.state && /^[A-Za-z]{2}$/.test(body.state)) {
    const { data: region } = await supabase
      .from('operating_regions')
      .select('min_age')
      .eq('state', body.state.toUpperCase())
      .maybeSingle();
    if (region?.min_age) minAge = region.min_age;
  }

  const age = ageInYears(dob, new Date());
  const verified = age >= minAge;

  // Optionally persist a freshly-submitted DOB to the profile (one-time gate).
  if (verified && body.persist && body.date_of_birth) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ date_of_birth: body.date_of_birth })
      .eq('id', user.id);
    if (updateError) {
      console.error('age-verify profile update error', updateError);
    }
  }

  return jsonResponse({ verified, age, min_age: minAge });
});
