// =============================================================================
// Rate limiting for demo voice endpoint (durable, Supabase-backed — migration 065)
//
// Replaces the previous in-memory Maps that did not survive serverless cold
// starts or span instances. Preserves the same effective limits:
//   1. Per-IP burst protection: 1 request per 60-second window
//   2. Global daily cap: 500 requests/day to bound ElevenLabs spend
//      (now shared across all instances rather than per-instance)
// =============================================================================
import { checkRateLimit } from '@/lib/rate-limit.js';

const IP_LIMIT = 1;
const IP_WINDOW_SECONDS = 60;
const GLOBAL_DAILY_CAP = 500;
const DAY_SECONDS = 86400;

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
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

    // Rate limiting: global daily cap, then per-IP cooldown (durable, migration 065)
    const ip = getClientIp(request);
    const today = new Date().toISOString().slice(0, 10);

    const globalCheck = await checkRateLimit({
      bucket: 'demo-voice-global',
      key: today,
      limit: GLOBAL_DAILY_CAP,
      windowSeconds: DAY_SECONDS,
    });
    if (!globalCheck.allowed) {
      return Response.json({ error: 'Please wait before trying again' }, { status: 429 });
    }

    const ipCheck = await checkRateLimit({
      bucket: 'demo-voice-ip',
      key: ip,
      limit: IP_LIMIT,
      windowSeconds: IP_WINDOW_SECONDS,
    });
    if (!ipCheck.allowed) {
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
