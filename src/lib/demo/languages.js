/**
 * Demo Studio "Language" choice: what the agent's speech-to-text listens for.
 *
 * The id goes into the room metadata as `stt_language` and is read by the
 * agent (livekit-agent src/agents/appointments/pipeline.py
 * ::resolve_stt_language). It is honoured on test calls only; production
 * calls always listen for every language.
 *
 * English only is the default: with every language allowed, a spoken take on
 * 2026-11-25 heard short English replies as words from other languages
 * ("Apa" for a time of day).
 */
export const LANGUAGE_OPTIONS = [
  {
    id: 'en',
    label: 'English only',
    hint: 'The agent listens for English only. Short replies such as “Two” or “Yes” are heard more reliably.',
  },
  {
    id: 'multi',
    label: 'Multilingual',
    hint: 'The agent listens for any language and can switch mid-call, as phone calls do today. Short English replies can be misheard.',
  },
];

export const DEFAULT_LANGUAGE_ID = 'en';
export const LANGUAGE_IDS = new Set(LANGUAGE_OPTIONS.map((l) => l.id));

export function getLanguage(id) {
  return LANGUAGE_OPTIONS.find((l) => l.id === id) || null;
}
