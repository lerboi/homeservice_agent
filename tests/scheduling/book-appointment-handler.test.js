import { describe, test, expect } from '@jest/globals';
import { getAgentConfig } from '@/lib/retell-agent-config.js';

describe('getAgentConfig - book_appointment function', () => {
  test('onboarding_complete=true includes book_appointment in functions', () => {
    const config = getAgentConfig({ onboarding_complete: true });
    const names = config.functions.map((f) => f.name);
    expect(names).toContain('book_appointment');
  });

  test('onboarding_complete=false does NOT include book_appointment', () => {
    const config = getAgentConfig({ onboarding_complete: false });
    const names = config.functions.map((f) => f.name);
    expect(names).not.toContain('book_appointment');
  });

  test('book_appointment function has all 5 required parameters', () => {
    const config = getAgentConfig({ onboarding_complete: true });
    const fn = config.functions.find((f) => f.name === 'book_appointment');
    expect(fn).toBeDefined();
    expect(fn.parameters.required).toEqual(
      expect.arrayContaining(['slot_start', 'slot_end', 'service_address', 'caller_name', 'urgency'])
    );
    expect(fn.parameters.required).toHaveLength(5);
  });

  test('book_appointment description contains "reading back the address"', () => {
    const config = getAgentConfig({ onboarding_complete: true });
    const fn = config.functions.find((f) => f.name === 'book_appointment');
    expect(fn).toBeDefined();
    expect(fn.description).toContain('reading back the address');
  });

  test('transfer_call is always present when onboarding_complete=false', () => {
    const config = getAgentConfig({ onboarding_complete: false });
    const names = config.functions.map((f) => f.name);
    expect(names).toContain('transfer_call');
  });

  test('transfer_call is always present when onboarding_complete=true', () => {
    const config = getAgentConfig({ onboarding_complete: true });
    const names = config.functions.map((f) => f.name);
    expect(names).toContain('transfer_call');
  });

  test('urgency parameter has enum values: emergency, routine, high_ticket', () => {
    const config = getAgentConfig({ onboarding_complete: true });
    const fn = config.functions.find((f) => f.name === 'book_appointment');
    const urgency = fn.parameters.properties.urgency;
    expect(urgency.enum).toEqual(expect.arrayContaining(['emergency', 'routine', 'high_ticket']));
  });

  test('slot_start parameter has type string', () => {
    const config = getAgentConfig({ onboarding_complete: true });
    const fn = config.functions.find((f) => f.name === 'book_appointment');
    expect(fn.parameters.properties.slot_start.type).toBe('string');
  });

  test('slot_end parameter has type string', () => {
    const config = getAgentConfig({ onboarding_complete: true });
    const fn = config.functions.find((f) => f.name === 'book_appointment');
    expect(fn.parameters.properties.slot_end.type).toBe('string');
  });
});
