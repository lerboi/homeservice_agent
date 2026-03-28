import { describe, test, expect } from '@jest/globals';
import { buildSystemPrompt } from '../../../Retell-ws-server/agent-prompt.js';

describe('booking-first behavior (Phase 14)', () => {
  const bookingPrompt = buildSystemPrompt('en', {
    business_name: 'Ace Plumbing',
    onboarding_complete: true,
    tone_preset: 'professional',
  });

  // BOOK-01: Booking-first protocol replaces old booking flow
  test('contains BOOKING PROTOCOL section', () => {
    expect(bookingPrompt).toContain('BOOKING PROTOCOL');
  });

  test('does NOT contain old TRIAGE-AWARE BEHAVIOR section', () => {
    expect(bookingPrompt).not.toContain('TRIAGE-AWARE BEHAVIOR');
  });

  test('does NOT contain emergency/routine tone split', () => {
    expect(bookingPrompt).not.toContain('For EMERGENCY calls: Use urgent');
    expect(bookingPrompt).not.toContain('For ROUTINE calls: Use relaxed');
  });

  // BOOK-02: Info-only caller handling (D-01, D-02)
  test('contains booking offer instruction for info-only callers', () => {
    expect(bookingPrompt).toContain('I can get you on the schedule');
  });

  test('contains quote-to-site-visit reframe (D-02)', () => {
    expect(bookingPrompt).toContain('To give an accurate quote');
  });

  // BOOK-03: Decline handling (D-03, D-04, D-05)
  test('contains DECLINE HANDLING section', () => {
    expect(bookingPrompt).toContain('DECLINE HANDLING');
  });

  test('contains soft re-offer on first decline (D-03)', () => {
    expect(bookingPrompt).toContain('No problem');
  });

  test('contains lead save instruction after second decline (D-04)', () => {
    expect(bookingPrompt).toContain("I've saved your info");
  });

  // BOOK-03: Transfer restrictions (D-06, D-07, D-09)
  test('contains FAILED CLARIFICATIONS section', () => {
    expect(bookingPrompt).toContain('3 FAILED CLARIFICATIONS');
  });

  test('contains instant transfer on explicit request (D-07)', () => {
    expect(bookingPrompt).toContain('Absolutely, let me connect you now');
  });

  // BOOK-01: Urgency affects slot priority, not tone (D-11, D-12)
  test('contains urgency rule for slot priority', () => {
    expect(bookingPrompt).toContain('URGENCY RULE');
  });

  // Preserved behaviors (must survive rewrite)
  test('still contains address read-back requirement', () => {
    expect(bookingPrompt).toContain('Just to confirm');
  });

  test('still contains LANGUAGE section', () => {
    expect(bookingPrompt).toContain('LANGUAGE:');
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
