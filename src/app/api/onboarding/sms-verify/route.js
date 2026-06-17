import { createSupabaseServer } from '@/lib/supabase-server';
import { normalizeE164 } from '@/lib/phone/normalize.js';
import { checkRateLimit } from '@/lib/rate-limit.js';

// Per-user rate limit (durable, Supabase-backed — migration 065): 5 OTP sends/hour.
// Prevents SMS-pumping abuse via unvalidated/looped OTP requests.
const USER_LIMIT = 5;
const USER_WINDOW_SECONDS = 3600;

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateCheck = await checkRateLimit({
    bucket: 'sms-verify-user',
    key: user.id,
    limit: USER_LIMIT,
    windowSeconds: USER_WINDOW_SECONDS,
  });
  if (!rateCheck.allowed) {
    return Response.json(
      { error: 'Too many verification attempts. Please try again later.' },
      { status: 429 }
    );
  }

  const { phone } = await request.json();

  // Validate + normalize to E.164 before forwarding to the SMS provider
  let normalizedPhone;
  try {
    normalizedPhone = normalizeE164(phone);
  } catch {
    console.log('400: Invalid phone number');
    return Response.json({ error: 'Invalid phone number' }, { status: 400 });
  }

  const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });

  if (error) {
    console.log('400:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ sent: true });
}
