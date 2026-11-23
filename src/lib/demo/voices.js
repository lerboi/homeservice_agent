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
  // Checked against the Voco ElevenLabs account on 2026-11-24 (GET /v1/voices):
  // every id below is in the account, so the agent can speak with it. A voice
  // that is NOT in the account does not fail loudly: the agent logs an error
  // and speaks the whole call in its fallback voice (livekit-agent
  // src/agent.py _build_tts), which is why picking a voice here used to change
  // nothing. Seven of the ten voices listed before that date were not in the
  // account. Before adding an id, confirm it is returned by /v1/voices.
  //
  // The Production group mirrors src/agent.py ELEVENLABS_VOICE_MAP. Its
  // "friendly" voice (dj3G1R1ilKoFKhBnWOzG) is not in the account either, so
  // it is not offered here.
  { id: 'kdmDKE6EkgrWrrykO9Qt', label: 'Alexandra: chatty young female (production default / professional)', group: 'Production' },
  { id: '56AoDkrOh6qfVPDXZ7Pt', label: 'Cassidy: engaging, energetic (local_expert)', group: 'Production' },
  // Singapore-accent English, from the ElevenLabs Voice Library (searched
  // 2026-11-24). These must be ADDED to the account ("Add to My Voices" on
  // the voice's page in ElevenLabs) before the agent will speak with them;
  // until then a call falls back to the agent's default voice. The agent
  // re-reads the account's voice list when a test call asks for a voice it
  // does not know, so a newly added voice works without a redeploy.
  { id: '6qpxBH5KUSDb40bij36w', label: 'Lilian: warm, calm, young woman (Singaporean)', group: 'Singapore accent (add to My Voices first)' },
  { id: 'SEWXl8lPSO01tdGbWECX', label: 'Cynthia: professional woman (Singaporean)', group: 'Singapore accent (add to My Voices first)' },
  { id: 'Y7xQSS5ZtS4xv4VJotWd', label: 'Christine: calm, professional woman (Singaporean)', group: 'Singapore accent (add to My Voices first)' },
  { id: 'aFxDLa1A1dSRlzW8nziT', label: 'Lim: neutral, clear man (Singaporean)', group: 'Singapore accent (add to My Voices first)' },
  { id: 'owsLoyJNU4K7ctU6NF7F', label: 'Mun: friendly, clear man (Singaporean)', group: 'Singapore accent (add to My Voices first)' },
  // Female
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah: warm, professional', group: 'Female' },
  { id: 'hpp4J3VqNfWAUOO0d1Us', label: 'Bella: professional, bright, warm', group: 'Female' },
  { id: 'cgSgspJ2msm6clMCkdW9', label: 'Jessica: playful, bright, warm', group: 'Female' },
  { id: 'XrExE9yKIg1WjnnlVkGX', label: 'Matilda: knowledgeable, professional', group: 'Female' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice: clear, engaging (British)', group: 'Female' },
  { id: '8tsLeAV5vPVuzCCvqbbU', label: 'Eryn: confident, corporate', group: 'Female' },
  // Male
  { id: 'cjVigY5qzO86Huf0OWal', label: 'Eric: smooth, trustworthy', group: 'Male' },
  { id: 'iP95p4xoKVk53GoZ742B', label: 'Chris: charming, down to earth', group: 'Male' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', label: 'Roger: laid back, casual', group: 'Male' },
  { id: 'bIHbv24MWmeRgasZH58o', label: 'Will: relaxed, optimistic', group: 'Male' },
  { id: 'nPczCjzI2devNBz1zQrb', label: 'Brian: deep, comforting', group: 'Male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel: steady (British)', group: 'Male' },
];

export const VOICE_IDS = new Set(VOICE_OPTIONS.map((v) => v.id));
