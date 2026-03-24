import { describe, test, expect } from '@jest/globals';
import { buildSystemPrompt } from '../../../Retell-ws-server/agent-prompt.js';

describe('booking-first behavior (Phase 14)', () => {
  const bookingPrompt = buildSystemPrompt('en', {
    business_name: 'Ace Plumbing',
    onboarding_complete: true,
    tone_preset: 'professional',
  });

  // BOOK-01: Booking-first protocol replaces old booking flow
  test('contains BOOKING-FIRST PROTOCOL section', () => {
    expect(bookingPrompt).toContain('BOOKING-FIRST PROTOCOL');
  });

  test('does NOT contain old TRIAGE-AWARE BEHAVIOR section', () => {
    expect(bookingPrompt).not.toContain('TRIAGE-AWARE BEHAVIOR');
  });

  test('does NOT contain emergency/routine tone split', () => {
    expect(bookingPrompt).not.toContain('For EMERGENCY calls: Use urgent');
    expect(bookingPrompt).not.toContain('For ROUTINE calls: Use relaxed');
  });

  // BOOK-02: Info-only caller handling (D-01, D-02)
  test('contains info-then-pivot instruction for info-only callers', () => {
    expect(bookingPrompt).toContain('I can also get you on the schedule');
  });

  test('contains quote-to-site-visit reframe (D-02)', () => {
    expect(bookingPrompt).toContain('To give you an accurate quote');
  });

  // BOOK-03: Decline handling (D-03, D-04, D-05)
  test('contains DECLINE HANDLING section', () => {
    expect(bookingPrompt).toContain('DECLINE HANDLING');
  });

  test('contains soft re-offer on first decline (D-03)', () => {
    expect(bookingPrompt).toContain('No problem');
  });

  test('contains capture_lead instruction after second decline (D-04)', () => {
    expect(bookingPrompt).toContain('capture_lead');
  });

  // BOOK-03: Transfer restrictions (D-06, D-07, D-09)
  test('contains CLARIFICATION LIMIT section', () => {
    expect(bookingPrompt).toContain('CLARIFICATION LIMIT');
  });

  test('contains 3-attempt clarification instruction (D-06)', () => {
    expect(bookingPrompt).toContain('Could you describe what you');
  });

  test('contains instant transfer on explicit request (D-07)', () => {
    expect(bookingPrompt).toContain('Absolutely, let me connect you now');
  });

  // BOOK-01: Urgency affects slot priority, not tone (D-11, D-12)
  test('contains urgency detection for slot priority', () => {
    expect(bookingPrompt).toContain('URGENCY DETECTION');
  });

  // Preserved behaviors (must survive rewrite)
  test('still contains address read-back requirement', () => {
    expect(bookingPrompt).toContain('Just to confirm');
  });

  test('still contains LANGUAGE INSTRUCTIONS section', () => {
    expect(bookingPrompt).toContain('LANGUAGE INSTRUCTIONS');
  });

  test('still contains recording disclosure', () => {
    expect(bookingPrompt).toContain('This call may be recorded');
  });

  test('still contains 9-minute wrap-up', () => {
    expect(bookingPrompt).toContain('9 minutes');
  });

  test('still contains LANGUAGE_BARRIER tag', () => {
    expect(bookingPrompt).toContain('LANGUAGE_BARRIER');
  });
});
