import sitemapFn from '../../src/app/sitemap.js';

describe('sitemap.js', () => {
  let entries;

  beforeAll(() => {
    entries = sitemapFn();
  });

  test('returns an array', () => {
    expect(Array.isArray(entries)).toBe(true);
  });

  test('each entry has url, lastModified, changeFrequency, priority', () => {
    for (const entry of entries) {
      expect(typeof entry.url).toBe('string');
      expect(entry.lastModified).toBeDefined();
      expect(typeof entry.changeFrequency).toBe('string');
      expect(typeof entry.priority).toBe('number');
    }
  });

  test('contains the static root URL https://voco.live with priority 1.0', () => {
    const root = entries.find((e) => e.url === 'https://voco.live');
    expect(root).toBeDefined();
    expect(root.priority).toBe(1.0);
  });

  test('contains at least one dynamic blog route matching https://voco.live/blog/', () => {
    const blogEntry = entries.find((e) => e.url.startsWith('https://voco.live/blog/'));
    expect(blogEntry).toBeDefined();
  });

  test('total count is >= 14 (9 static + 5 dynamic seeds)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(14);
  });

  test('contains the /pricing static route', () => {
    const pricing = entries.find((e) => e.url === 'https://voco.live/pricing');
    expect(pricing).toBeDefined();
    expect(pricing.priority).toBe(0.9);
  });

  test('contains a persona route matching https://voco.live/for/', () => {
    const personaEntry = entries.find((e) => e.url.startsWith('https://voco.live/for/'));
    expect(personaEntry).toBeDefined();
  });

  test('contains a comparison route matching https://voco.live/compare/', () => {
    const compEntry = entries.find((e) => e.url.startsWith('https://voco.live/compare/'));
    expect(compEntry).toBeDefined();
  });

  test('contains an integration route matching https://voco.live/integrations/', () => {
    const intEntry = entries.find((e) => e.url.startsWith('https://voco.live/integrations/'));
    expect(intEntry).toBeDefined();
  });

  test('contains a glossary route matching https://voco.live/glossary/', () => {
    const glossEntry = entries.find((e) => e.url.startsWith('https://voco.live/glossary/'));
    expect(glossEntry).toBeDefined();
  });
});
