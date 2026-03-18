import { describe, test, expect } from '@jest/globals';
import { getAgentConfig } from '@/lib/retell-agent-config.js';

describe('getAgentConfig', () => {
  const config = getAgentConfig({ business_name: 'Test Business', locale: 'en' });
  const esConfig = getAgentConfig({ business_name: 'Test Business', locale: 'es' });

  test('returns an object', () => {
    expect(typeof config).toBe('object');
    expect(config).not.toBeNull();
  });

  test('sets language to multilingual', () => {
    expect(config.language).toBe('multilingual');
  });

  test('includes a non-empty system_prompt string', () => {
    expect(typeof config.system_prompt).toBe('string');
    expect(config.system_prompt.length).toBeGreaterThan(0);
  });

  test('includes a functions array', () => {
    expect(Array.isArray(config.functions)).toBe(true);
    expect(config.functions.length).toBeGreaterThan(0);
  });

  test('first function is named transfer_call', () => {
    expect(config.functions[0].name).toBe('transfer_call');
  });

  test('transfer_call function has a non-empty description', () => {
    expect(typeof config.functions[0].description).toBe('string');
    expect(config.functions[0].description.length).toBeGreaterThan(0);
  });

  test('transfer_call function has no required parameters', () => {
    const params = config.functions[0].parameters;
    expect(params).toBeDefined();
    expect(Array.isArray(params.required)).toBe(true);
    expect(params.required.length).toBe(0);
  });

  test('Spanish locale config still sets language to multilingual', () => {
    expect(esConfig.language).toBe('multilingual');
  });

  test('Spanish locale config includes Spanish in system_prompt', () => {
    expect(esConfig.system_prompt).toContain('Esta llamada puede ser grabada');
  });

  test('uses defaults when called with no arguments', () => {
    const defaultConfig = getAgentConfig();
    expect(defaultConfig.language).toBe('multilingual');
    expect(typeof defaultConfig.system_prompt).toBe('string');
    expect(Array.isArray(defaultConfig.functions)).toBe(true);
  });
});
