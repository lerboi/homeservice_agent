// IP-based rate limiting — module-level Map persists across requests in the same server instance
const rateLimitMap = new Map();
const RATE_LIMIT_MS = 10000; // 10 seconds per IP
const RATE_LIMIT_CLEANUP_MS = 60000; // Clean entries older than 60 seconds

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip) {
  const now = Date.now();

  // Clean entries older than 60 seconds to prevent memory leak
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
