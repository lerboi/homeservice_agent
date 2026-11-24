/**
 * Demo Studio voice quality and greeting choices. Pure data and functions,
 * unit-tested.
 *
 * `QUALITY_OPTIONS` must list the same ids, with the same settings, as
 * VOICE_QUALITY in livekit-agent src/agent.py: the agent builds its speech
 * from that table when a test call's server-set metadata carries
 * `voice_quality`, and the preview route here builds a sample from this one,
 * so what is previewed is what the call will sound like. A production call
 * never reads either: it always speaks with the "fast" settings.
 *
 * Every quality uses uncompressed audio on a call (the agent's
 * ELEVENLABS_TTS_ENCODING); the preview is a high-bitrate MP3.
 */

// Mirrors livekit-agent src/agent.py: ELEVENLABS_TTS_MODEL, TTS_STABILITY,
// TTS_SIMILARITY, TTS_SPEED and the production default voice.
const PRODUCTION = { model: 'eleven_flash_v2_5', stability: 0.45, similarity_boost: 0.75, speed: 1.08 };
export const DEFAULT_PREVIEW_VOICE_ID = 'kdmDKE6EkgrWrrykO9Qt';

export const QUALITY_OPTIONS = [
  {
    id: 'fast',
    label: 'Fast',
    hint: 'What phone calls use today: the quickest model, spoken slightly faster than the voice’s own pace.',
    settings: {},
  },
  {
    id: 'natural',
    label: 'Natural',
    hint: 'The same quick model at the voice’s own pace. No slower to respond.',
    settings: { speed: 1.0 },
  },
  {
    id: 'turbo',
    label: 'Turbo',
    hint: 'A more expressive model at natural pace. Starts speaking a little later.',
    settings: { model: 'eleven_turbo_v2_5', speed: 1.0 },
  },
  {
    id: 'rich',
    label: 'Rich',
    hint: 'The most expressive model. The slowest to start speaking, so a call runs longer.',
    settings: { model: 'eleven_multilingual_v2', speed: 1.0, stability: 0.4, style: 0.2 },
  },
];

export const DEFAULT_QUALITY_ID = 'fast';
export const QUALITY_IDS = new Set(QUALITY_OPTIONS.map((q) => q.id));

export function getQuality(id) {
  return QUALITY_OPTIONS.find((q) => q.id === id) || null;
}

/**
 * The greeting the agent opens with. The text mirrors the demo agent's own
 * lines (livekit-agent src/agents/demo/entry.py PROFILE.greeting and
 * src/agents/appointments/entry.py WARM_GREETING).
 */
export const GREETING_OPTIONS = [
  {
    id: 'standard',
    label: 'Standard',
    text: (business) => `Thank you for calling ${business}. This call is recorded. How may I help you today?`,
  },
  {
    id: 'warm',
    label: 'Warm',
    text: (business) =>
      `Hi, thanks for calling ${business}! Just so you know, this call is recorded. How can I help you today?`,
  },
];

export const DEFAULT_GREETING_ID = 'standard';
export const GREETING_IDS = new Set(GREETING_OPTIONS.map((g) => g.id));

export function getGreeting(id) {
  return GREETING_OPTIONS.find((g) => g.id === id) || null;
}

/** What the sample says: the chosen greeting, then two lines from a booking. */
export function previewText(greetingId, businessName) {
  const greeting = getGreeting(greetingId) || getGreeting(DEFAULT_GREETING_ID);
  return `${greeting.text(businessName || 'Brightside Dental')} Tomorrow at two is free. Shall I book it?`;
}

/**
 * The ElevenLabs text-to-speech request for a sample.
 * @returns {{ voiceId: string, body: { text: string, model_id: string, voice_settings: object } }}
 */
export function buildPreviewRequest({ voiceId, quality, greeting, businessName }) {
  const { model, ...voice } = { ...PRODUCTION, ...(getQuality(quality) || getQuality(DEFAULT_QUALITY_ID)).settings };
  return {
    voiceId: voiceId || DEFAULT_PREVIEW_VOICE_ID,
    body: { text: previewText(greeting, businessName), model_id: model, voice_settings: voice },
  };
}
