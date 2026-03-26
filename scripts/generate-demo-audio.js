/**
 * generate-demo-audio.js
 *
 * One-time script to pre-render the static demo audio segments for the hero section
 * interactive demo. Run this after setting up your ElevenLabs API credentials.
 *
 * Usage:
 *   node scripts/generate-demo-audio.js
 *
 * Required env vars in .env.local:
 *   ELEVENLABS_API_KEY
 *   ELEVENLABS_VOICE_ID_AI       (AI receptionist voice — female, professional)
 *   ELEVENLABS_VOICE_ID_CALLER   (Caller voice — male, casual)
 *
 * Output:
 *   public/audio/demo-intro.mp3   — Caller opening line
 *   public/audio/demo-mid.mp3     — Mid-conversation (multi-voice, concatenated)
 *   public/audio/demo-outro.mp3   — Booking confirmation closing (AI voice)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars from .env.local
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch {
  // dotenv not available — rely on environment variables being set externally
  console.warn('[generate-demo-audio] dotenv not found — using existing process.env');
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID_AI = process.env.ELEVENLABS_VOICE_ID_AI;
const VOICE_ID_CALLER = process.env.ELEVENLABS_VOICE_ID_CALLER;

// Validate required env vars
if (!ELEVENLABS_API_KEY || !VOICE_ID_AI || !VOICE_ID_CALLER) {
  console.error(
    '[generate-demo-audio] ERROR: Missing required environment variables.\n' +
    'Please set ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID_AI, and ELEVENLABS_VOICE_ID_CALLER in .env.local'
  );
  process.exit(1);
}

// Audio output directory
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/audio');

// Demo script segments
// Playback order: [ringtone] → [silence] → [dynamic AI greeting] → [mid conversation] → [outro]
// The ringtone is generated programmatically in the player via Web Audio API, not here.
// Segment 1 (dynamic): AI greeting with business name — generated at runtime via /api/demo-voice
//   "Hi, I'm John from {businessName}, how can I help you today?"
// Segment 2: Mid-conversation (caller responds, then multi-voice back-and-forth)
// Segment 3: Booking confirmation closing (AI voice)
const SEGMENTS = [
  {
    name: 'demo-intro',
    // Caller's first response after the AI greeting
    parts: [
      {
        voiceId: VOICE_ID_CALLER,
        text: "Hey... yeah, I was hoping to get my AC serviced before summer hits.",
      },
    ],
  },
  {
    name: 'demo-mid',
    // Multi-voice segment — generated as sequential TTS calls and concatenated
    // MP3 is frame-based: concatenated MP3 frames play sequentially without re-encoding
    parts: [
      {
        voiceId: VOICE_ID_AI,
        text: "Of course... I can definitely help with that. What's your address?",
      },
      {
        voiceId: VOICE_ID_CALLER,
        text: "It's 214 Oak Street.",
      },
      {
        voiceId: VOICE_ID_AI,
        text: "Great... and when works best for you?",
      },
      {
        voiceId: VOICE_ID_CALLER,
        text: "Um, sometime Thursday afternoon if possible.",
      },
      {
        voiceId: VOICE_ID_AI,
        text: "Let me check the calendar for you... Yep, Thursday at 2 PM is open. I'll go ahead and book that in.",
      },
      {
        voiceId: VOICE_ID_CALLER,
        text: "Oh perfect, thanks.",
      },
    ],
  },
  {
    name: 'demo-outro',
    parts: [
      {
        voiceId: VOICE_ID_AI,
        text: "You're all set... Thursday at 2 PM at 214 Oak Street. We'll send you a reminder beforehand. Have a great day!",
      },
    ],
  },
];

/**
 * Call ElevenLabs TTS REST API and return the audio as a Buffer.
 */
async function generateTTS(text, voiceId) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.55, similarity_boost: 0.75, speed: 0.9 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`ElevenLabs TTS failed for voice ${voiceId}: ${response.status} ${errBody}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Generate all parts of a segment and concatenate into a single MP3 buffer.
 * For single-part segments, returns the buffer directly.
 * For multi-part segments, concatenates all MP3 buffers (valid because MP3 is frame-based).
 */
async function generateSegment(segment) {
  const buffers = [];

  for (const part of segment.parts) {
    console.log(`  Generating part: "${part.text.substring(0, 50)}${part.text.length > 50 ? '...' : ''}"`);
    const buf = await generateTTS(part.text, part.voiceId);
    buffers.push(buf);
  }

  return buffers.length === 1 ? buffers[0] : Buffer.concat(buffers);
}

async function main() {
  console.log('[generate-demo-audio] Starting audio generation...\n');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const segment of SEGMENTS) {
    const outputPath = path.join(OUTPUT_DIR, `${segment.name}.mp3`);
    console.log(`Generating ${segment.name}...`);

    try {
      const audioBuffer = await generateSegment(segment);
      fs.writeFileSync(outputPath, audioBuffer);
      console.log(`  Saved ${outputPath} (${audioBuffer.length.toLocaleString()} bytes)\n`);
      successCount++;
    } catch (err) {
      console.error(`  ERROR generating ${segment.name}:`, err.message, '\n');
      errorCount++;
    }
  }

  console.log(`\n[generate-demo-audio] Done. ${successCount} succeeded, ${errorCount} failed.`);

  if (errorCount > 0) {
    console.log('\nCheck your ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID_AI, and ELEVENLABS_VOICE_ID_CALLER in .env.local');
    process.exit(1);
  }

  console.log('\nNext steps:');
  console.log('  1. Verify the audio files sound correct:');
  console.log('     - public/audio/demo-intro.mp3  (caller opening line)');
  console.log('     - public/audio/demo-mid.mp3    (multi-voice conversation)');
  console.log('     - public/audio/demo-outro.mp3  (AI booking confirmation)');
  console.log('  2. Test the dynamic name endpoint:');
  console.log('     curl -X POST http://localhost:3000/api/demo-voice \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"businessName":"Smith Plumbing"}\' \\');
  console.log('       --output test.mp3');
  console.log('  3. Commit the generated MP3 files to the repo.');
}

main().catch((err) => {
  console.error('[generate-demo-audio] Fatal error:', err);
  process.exit(1);
});
