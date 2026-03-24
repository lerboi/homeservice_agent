import { describe, test, expect } from '@jest/globals';
import { buildWhisperMessage } from '@/lib/whisper-message.js';

describe('buildWhisperMessage (D-08 template format)', () => {
  test('full params: emergency produces correct whisper message', () => {
    const result = buildWhisperMessage({
      callerName: 'John Smith',
      jobType: 'pipe burst',
      urgency: 'emergency',
      summary: 'Water flooding basement',
    });
    expect(result).toBe('John Smith calling about pipe burst. Emergency. Water flooding basement');
  });

  test('routine urgency produces "Routine" label', () => {
    const result = buildWhisperMessage({
      callerName: 'Jane Doe',
      jobType: 'water heater repair',
      urgency: 'routine',
      summary: 'Cold showers for a week',
    });
    expect(result).toContain('Routine');
    expect(result).not.toContain('Emergency');
  });

  test('high_ticket urgency produces "Routine" label (not emergency)', () => {
    const result = buildWhisperMessage({
      callerName: 'Bob Jones',
      jobType: 'whole home remodel',
      urgency: 'high_ticket',
      summary: 'Full kitchen renovation',
    });
    expect(result).toContain('Routine');
    expect(result).not.toContain('Emergency');
  });

  test('missing callerName defaults to "Unknown caller"', () => {
    const result = buildWhisperMessage({
      jobType: 'drain cleaning',
      urgency: 'routine',
      summary: 'Slow drain',
    });
    expect(result).toContain('Unknown caller');
  });

  test('missing jobType defaults to "unspecified job"', () => {
    const result = buildWhisperMessage({
      callerName: 'Alice',
      urgency: 'routine',
      summary: 'Not sure what to call it',
    });
    expect(result).toContain('unspecified job');
  });

  test('missing urgency defaults to "Routine"', () => {
    const result = buildWhisperMessage({
      callerName: 'Mike',
      jobType: 'AC service',
      summary: 'Unit not cooling',
    });
    expect(result).toContain('Routine');
    expect(result).not.toContain('Emergency');
  });

  test('missing summary produces no trailing space (trim handles it)', () => {
    const result = buildWhisperMessage({
      callerName: 'Tom',
      jobType: 'leak repair',
      urgency: 'emergency',
    });
    expect(result).toBe('Tom calling about leak repair. Emergency.');
    expect(result).not.toMatch(/ $/);
  });

  test('empty object returns correct fallback string', () => {
    const result = buildWhisperMessage({});
    expect(result).toBe('Unknown caller calling about unspecified job. Routine.');
  });

  test('no arguments returns correct fallback string', () => {
    const result = buildWhisperMessage();
    expect(result).toBe('Unknown caller calling about unspecified job. Routine.');
  });
});
