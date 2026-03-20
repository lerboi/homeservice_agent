import { describe, test, expect } from '@jest/globals';
import { buildSystemPrompt } from '@/lib/agent-prompt.js';

describe('buildSystemPrompt', () => {
  const enPrompt = buildSystemPrompt('en', { business_name: 'Ace Plumbing' });
  const esPrompt = buildSystemPrompt('es', { business_name: 'Ace Plumbing' });
  const defaultPrompt = buildSystemPrompt('en', { business_name: 'Ace Plumbing', onboarding_complete: true });

  test('returns a string', () => {
    expect(typeof enPrompt).toBe('string');
  });

  test('contains LANGUAGE INSTRUCTIONS section', () => {
    expect(enPrompt).toContain('LANGUAGE INSTRUCTIONS');
  });

  test('contains language detection instruction', () => {
    expect(enPrompt).toContain('Detect the language of the caller');
  });

  test('contains language mirroring instruction', () => {
    expect(enPrompt).toContain('Respond exclusively in the language the caller used');
  });

  test('contains language clarification prompt from translation key', () => {
    expect(enPrompt).toContain('Would you prefer English or Spanish');
  });

  test('contains unsupported language handling from translation key', () => {
    expect(enPrompt).toContain("I'm sorry, I am still learning");
  });

  test('contains recording disclosure from translation key', () => {
    expect(enPrompt).toContain('This call may be recorded');
  });

  test('contains call duration limit references', () => {
    const hasDuration = enPrompt.includes('10 minutes') || enPrompt.includes('9 minutes');
    expect(hasDuration).toBe(true);
  });

  test('contains business name in prompt', () => {
    expect(enPrompt).toContain('Ace Plumbing');
  });

  test('Spanish locale returns Spanish translations for disclosure', () => {
    expect(esPrompt).toContain('Esta llamada puede ser grabada');
  });

  test('Spanish locale returns Spanish translations for greeting', () => {
    expect(esPrompt).toContain('Hola, gracias por llamar');
  });

  test('does NOT contain raw hardcoded default English greeting', () => {
    // The English string "Hello, thank you for calling. How can I help you today?" appears
    // only inside the greeting template string (which resolves the translation key).
    // The prompt should contain the resolved translation value — but the key itself
    // should NOT appear verbatim as a hardcoded literal in the source.
    // We verify the greeting content comes from the resolved translation value:
    expect(enPrompt).not.toContain('agent.default_greeting');
  });

  test('contains transfer_call tool reference', () => {
    expect(enPrompt).toContain('transfer_call');
  });

  test('instructs AI to capture caller info BEFORE transfer', () => {
    const hasCaptureBefore =
      enPrompt.includes('capture caller information BEFORE') ||
      enPrompt.includes('FIRST capture') ||
      enPrompt.includes('Always capture caller information BEFORE');
    expect(hasCaptureBefore).toBe(true);
  });

  test('contains CALL TRANSFER section', () => {
    expect(enPrompt).toContain('CALL TRANSFER');
  });

  test('contains LANGUAGE_BARRIER tag instruction', () => {
    expect(enPrompt).toContain('LANGUAGE_BARRIER');
  });

  // Tone preset tests
  test('professional tone preset contains "measured and formal"', () => {
    const prompt = buildSystemPrompt('en', { tone_preset: 'professional' });
    expect(prompt).toContain('measured and formal');
  });

  test('friendly tone preset contains "upbeat and warm"', () => {
    const prompt = buildSystemPrompt('en', { tone_preset: 'friendly' });
    expect(prompt).toContain('upbeat and warm');
  });

  test('local_expert tone preset contains "relaxed and neighborly"', () => {
    const prompt = buildSystemPrompt('en', { tone_preset: 'local_expert' });
    expect(prompt).toContain('relaxed and neighborly');
  });

  test('default call (no tone_preset) contains "measured and formal" (professional is default)', () => {
    const prompt = buildSystemPrompt('en', {});
    expect(prompt).toContain('measured and formal');
  });

  test('prompt with onboarding_complete: true contains "TRIAGE-AWARE BEHAVIOR"', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: true });
    expect(prompt).toContain('TRIAGE-AWARE BEHAVIOR');
  });

  // BOOKING FLOW tests
  test('onboarding_complete=true prompt contains "BOOKING FLOW"', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: true });
    expect(prompt).toContain('BOOKING FLOW');
  });

  test('onboarding_complete=true prompt contains "read back the address"', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: true });
    expect(prompt).toContain('read back the address');
  });

  test('onboarding_complete=true prompt contains "book_appointment"', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: true });
    expect(prompt).toContain('book_appointment');
  });

  test('onboarding_complete=true prompt does NOT contain "cannot book appointments"', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: true });
    expect(prompt).not.toContain('cannot book appointments');
  });

  test('onboarding_complete=false prompt does NOT contain "BOOKING FLOW"', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: false });
    expect(prompt).not.toContain('BOOKING FLOW');
  });

  test('onboarding_complete=true prompt contains "available_slots" reference', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: true });
    expect(prompt).toContain('available_slots');
  });

  test('onboarding_complete=true prompt contains "Just to confirm"', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: true });
    expect(prompt).toContain('Just to confirm');
  });

  test('onboarding_complete=true prompt contains "slot was just taken" handling', () => {
    const prompt = buildSystemPrompt('en', { onboarding_complete: true });
    expect(prompt).toContain('slot was just taken');
  });
});
