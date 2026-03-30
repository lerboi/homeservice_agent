// =============================================================================
// Rate limiting for demo voice endpoint
//
// LIMITATION: In-memory Maps do NOT persist across serverless cold starts or
// across multiple Vercel instances. A determined attacker can bypass this by
// waiting for a new instance. For production hardening, replace with Redis
// (e.g., Upstash) or a Supabase-backed rate limit table.
//
// Despite the limitation, this still provides:
// 1. Burst protection within a single warm instance (60s per-IP cooldown)
// 2. Global daily cap to limit total ElevenLabs API spend per instance
// =============================================================================
const rateLimitMap = new Map();
const RATE_LIMIT_MS = 60000; // 60 seconds per IP (increased from 10s)
const RATE_LIMIT_CLEANUP_MS = 120000; // Clean entries older than 2 minutes

// Global daily cap: limit total demo requests per server instance per day.
// Resets on cold start or when the day changes.
let globalDailyCount = 0;
let globalDailyDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const GLOBAL_DAILY_CAP = 500; // max demo requests per instance per day

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Reset global counter on new day
  if (today !== globalDailyDate) {
    globalDailyCount = 0;
    globalDailyDate = today;
  }

  // Check global daily cap
  if (globalDailyCount >= GLOBAL_DAILY_CAP) {
    return false;
  }

  // Clean entries older than cleanup window to prevent memory leak
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > RATE_LIMIT_CLEANUP_MS) {
      rateLimitMap.delete(key);
    }
  }

  const lastRequest = rateLimitMap.get(ip);
  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    return false; // Rate limited
  }

  rateLimitMap.set(ip, now);
  globalDailyCount++;
  return true; // Allowed
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { businessName } = body;

    // Validate businessName
    const clean = businessName?.trim();
    if (!clean || clean.length < 2 || clean.length > 100) {
      return Response.json({ error: 'Invalid business name' }, { status: 400 });
    }

    // IP-based rate limiting
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return Response.json({ error: 'Please wait before trying again' }, { status: 429 });
    }

    // Build TTS text — natural receptionist greeting with business name
    const text = `Hi there, this is John from ${clean}... how can I help you today?`;

    const voiceId = process.env.ELEVENLABS_VOICE_ID_AI;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    // Call ElevenLabs REST API
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.55, similarity_boost: 0.75, speed: 0.9 },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errText = await elevenLabsResponse.text();
      console.error('[demo-voice] ElevenLabs API error:', elevenLabsResponse.status, errText);
      return Response.json({ error: 'Voice generation failed' }, { status: 502 });
    }

    const audioBuffer = await elevenLabsResponse.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[demo-voice] Unexpected error:', error);
    return Response.json({ error: 'Failed to generate demo audio' }, { status: 500 });
  }
}
