import robotsFn from '../../src/app/robots.js';

describe('robots.js', () => {
  let result;

  beforeAll(() => {
    result = robotsFn();
  });

  test('returns an object', () => {
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  test('has rules array with userAgent * and allow /', () => {
    expect(Array.isArray(result.rules)).toBe(true);
    expect(result.rules.length).toBeGreaterThanOrEqual(1);
    const rule = result.rules[0];
    expect(rule.userAgent).toBe('*');
    expect(rule.allow).toBe('/');
  });

  test('has sitemap pointing to https://voco.live/sitemap.xml', () => {
    expect(result.sitemap).toBe('https://voco.live/sitemap.xml');
  });
});
