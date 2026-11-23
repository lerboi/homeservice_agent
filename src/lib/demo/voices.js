/**
 * Test-call voice options — the single source of truth for /admin/test-agent
 * and /admin/demo (the pages fetch the list; the session routes validate
 * against it). Grouped by accent. The agent only
 * honors the override on test calls, so production voice resolution
 * (tenants.ai_voice → ELEVENLABS_VOICE_MAP) is never affected.
 *
 * Every ID here must be usable by the Voco ElevenLabs account: the premade
 * default voices below are account-wide; any voice added from the community
 * Voice Library must first be saved to "My Voices" (livekit/agents #3992 —
 * an unavailable voice hard-fails the TTS). If a voice ever errors, the
 * mid-call FallbackAdapter degrades to OpenAI TTS rather than dead air.
 */
export const VOICE_OPTIONS = [
  // 2026-09-05: ElevenLabs' curated CONVERSATIONAL voices (their voice-agent
  // guide) — chatty cadence, not narration. Each id MUST be saved to the Voco
  // ElevenLabs account's "My Voices" before it will play (an unsaved voice
  // hard-fails and falls over to OpenAI "alloy"). The Production group mirrors
  // src/agent.py ELEVENLABS_VOICE_MAP; the rest are for auditioning here.
  { id: 'kdmDKE6EkgrWrrykO9Qt', label: 'Alexandra — chatty young female (production default / professional)', group: 'Production' },
  { id: 'dj3G1R1ilKoFKhBnWOzG', label: 'Eryn — friendly, relatable (friendly)', group: 'Production' },
  { id: '56AoDkrOh6qfVPDXZ7Pt', label: 'Cassidy — engaging, energetic (local_expert)', group: 'Production' },
  // Other ElevenLabs conversational picks to audition (female)
  { id: 'OYTbf65OHHFELVut7v2H', label: 'Hope — bright, uplifting', group: 'Conversational — female' },
  { id: 'PT4nqlKZfc06VW1BuClj', label: 'Angela — down to earth, great listener', group: 'Conversational — female' },
  { id: 'g6xIsTj2HwM6VR4iXFCw', label: 'Jessica Anne Bogart — empathetic, expressive', group: 'Conversational — female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah — warm, professional (classic)', group: 'Conversational — female' },
  // Male
  { id: '1SM7GgM6IMuvQlz2BwM3', label: 'Mark — relaxed, laid back', group: 'Conversational — male' },
  { id: 'HDA9tsk27wYi3uq0fPcK', label: 'Stuart — professional & friendly (Australian)', group: 'Conversational — male' },
  { id: 'L0Dsvb3SLTyegXwtm47J', label: 'Archer — grounded, friendly (British)', group: 'Conversational — male' },
];

export const VOICE_IDS = new Set(VOICE_OPTIONS.map((v) => v.id));
