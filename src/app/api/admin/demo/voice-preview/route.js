/**
 * POST /api/admin/demo/voice-preview — a spoken sample for the Demo Studio.
 *
 * Admin-only. Returns an MP3 of the chosen greeting and two lines from a
 * booking, spoken with the chosen voice and voice quality, so the owner can
 * hear a combination before starting a call. The request is built from the
 * same table the agent's settings mirror (src/lib/demo/voice-quality.js).
 *
 * Body: { voice?: string, quality?: string, greeting?: string, business_name?: string }
 * `voice` must be one of the listed voices ('' = the production default).
 */

import { verifyAdmin } from '@/lib/admin';
import { cleanBusinessName } from '@/lib/demo/session';
import { VOICE_IDS } from '@/lib/demo/voices';
import { GREETING_IDS, QUALITY_IDS, buildPreviewRequest } from '@/lib/demo/voice-quality';

export const maxDuration = 30;

export async function POST(request) {
  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const voice = typeof body.voice === 'string' ? body.voice.trim() : '';
  if (voice && !VOICE_IDS.has(voice)) {
    return Response.json({ error: 'voice must be one of the listed voices' }, { status: 400 });
  }
  const quality = typeof body.quality === 'string' && body.quality ? body.quality : 'fast';
  if (!QUALITY_IDS.has(quality)) {
    return Response.json({ error: 'quality must be one of the listed voice qualities' }, { status: 400 });
  }
  const greeting = typeof body.greeting === 'string' && body.greeting ? body.greeting : 'standard';
  if (!GREETING_IDS.has(greeting)) {
    return Response.json({ error: 'greeting must be one of the listed greetings' }, { status: 400 });
  }
  const businessName = cleanBusinessName(body.business_name);
  if (businessName === null) {
    return Response.json({ error: 'business_name must be a short plain name' }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ELEVENLABS_API_KEY is not set on this server' }, { status: 503 });
  }

  const sample = buildPreviewRequest({ voiceId: voice, quality, greeting, businessName });
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${sample.voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify(sample.body),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error('[demo/voice-preview] ElevenLabs error:', res.status, detail.slice(0, 300));
      // 400/404 here is almost always a voice that is not in the account.
      const reason =
        res.status === 400 || res.status === 404
          ? 'ElevenLabs does not have that voice in this account. Add it to My Voices first.'
          : `ElevenLabs returned ${res.status}`;
      return Response.json({ error: reason }, { status: 502 });
    }
    return new Response(await res.arrayBuffer(), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[demo/voice-preview] failed:', err);
    return Response.json({ error: 'Could not generate the sample' }, { status: 500 });
  }
}
