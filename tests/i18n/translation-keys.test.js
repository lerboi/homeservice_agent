import { describe, test, expect } from '@jest/globals';
import en from '../../messages/en.json' with { type: 'json' };
import es from '../../messages/es.json' with { type: 'json' };

function getKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getKeys(value, fullKey);
    }
    return [fullKey];
  });
}

describe('Translation key parity', () => {
  const enKeys = getKeys(en).sort();
  const esKeys = getKeys(es).sort();

  test('en.json and es.json have the same keys', () => {
    expect(enKeys).toEqual(esKeys);
  });

  test('no empty string values in en.json', () => {
    const enValues = Object.values(en).flatMap(ns => Object.values(ns));
    enValues.forEach(val => {
      expect(val).not.toBe('');
    });
  });

  test('no empty string values in es.json', () => {
    const esValues = Object.values(es).flatMap(ns => Object.values(ns));
    esValues.forEach(val => {
      expect(val).not.toBe('');
    });
  });

  test('en.json contains required agent keys', () => {
    const requiredKeys = [
      'agent.default_greeting',
      'agent.recording_disclosure',
      'agent.language_clarification',
      'agent.unsupported_language_apology',
    ];
    requiredKeys.forEach(key => {
      expect(enKeys).toContain(key);
    });
  });

  test('interpolation placeholders match between locales', () => {
    const placeholderRegex = /\{(\w+)\}/g;
    enKeys.forEach(key => {
      const parts = key.split('.');
      const enVal = parts.reduce((obj, k) => obj[k], en);
      const esVal = parts.reduce((obj, k) => obj[k], es);
      const enPlaceholders = [...(enVal.match(placeholderRegex) || [])].sort();
      const esPlaceholders = [...(esVal.match(placeholderRegex) || [])].sort();
      expect(esPlaceholders).toEqual(enPlaceholders);
    });
  });
});
