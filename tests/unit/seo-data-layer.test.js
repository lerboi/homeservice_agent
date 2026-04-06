import { BLOG_POSTS } from '../../src/data/blog.js';
import { PERSONAS } from '../../src/data/personas.js';
import { COMPARISONS } from '../../src/data/comparisons.js';
import { INTEGRATIONS } from '../../src/data/integrations.js';
import { GLOSSARY_TERMS } from '../../src/data/glossary.js';

describe('SEO Data Layer — BLOG_POSTS', () => {
  test('has at least 1 item', () => {
    expect(BLOG_POSTS.length).toBeGreaterThanOrEqual(1);
  });

  test('each item has slug (string)', () => {
    for (const post of BLOG_POSTS) {
      expect(typeof post.slug).toBe('string');
      expect(post.slug.length).toBeGreaterThan(0);
    }
  });

  test('each item has title (string)', () => {
    for (const post of BLOG_POSTS) {
      expect(typeof post.title).toBe('string');
      expect(post.title.length).toBeGreaterThan(0);
    }
  });

  test('each item has content (string, 1000+ words)', () => {
    for (const post of BLOG_POSTS) {
      expect(typeof post.content).toBe('string');
      const wordCount = post.content.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeGreaterThanOrEqual(1000);
    }
  });

  test('each item has excerpt (string)', () => {
    for (const post of BLOG_POSTS) {
      expect(typeof post.excerpt).toBe('string');
      expect(post.excerpt.length).toBeGreaterThan(0);
    }
  });

  test('each item has publishedAt (string)', () => {
    for (const post of BLOG_POSTS) {
      expect(typeof post.publishedAt).toBe('string');
      expect(post.publishedAt.length).toBeGreaterThan(0);
    }
  });
});

describe('SEO Data Layer — PERSONAS', () => {
  test('has at least 1 item', () => {
    expect(PERSONAS.length).toBeGreaterThanOrEqual(1);
  });

  test('each item has slug and trade (strings)', () => {
    for (const persona of PERSONAS) {
      expect(typeof persona.slug).toBe('string');
      expect(typeof persona.trade).toBe('string');
    }
  });

  test('each item has painPoints (array)', () => {
    for (const persona of PERSONAS) {
      expect(Array.isArray(persona.painPoints)).toBe(true);
      expect(persona.painPoints.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('each item has features (array)', () => {
    for (const persona of PERSONAS) {
      expect(Array.isArray(persona.features)).toBe(true);
      expect(persona.features.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('each item has testimonial with quote and author', () => {
    for (const persona of PERSONAS) {
      expect(typeof persona.testimonial).toBe('object');
      expect(typeof persona.testimonial.quote).toBe('string');
      expect(typeof persona.testimonial.author).toBe('string');
    }
  });
});

describe('SEO Data Layer — COMPARISONS', () => {
  test('has at least 1 item', () => {
    expect(COMPARISONS.length).toBeGreaterThanOrEqual(1);
  });

  test('each item has slug and title (strings)', () => {
    for (const comp of COMPARISONS) {
      expect(typeof comp.slug).toBe('string');
      expect(typeof comp.title).toBe('string');
    }
  });

  test('each item has competitorName (string)', () => {
    for (const comp of COMPARISONS) {
      expect(typeof comp.competitorName).toBe('string');
    }
  });

  test('each item has features (array of objects with name, voco, competitor)', () => {
    for (const comp of COMPARISONS) {
      expect(Array.isArray(comp.features)).toBe(true);
      expect(comp.features.length).toBeGreaterThanOrEqual(1);
      for (const feature of comp.features) {
        expect(typeof feature.name).toBe('string');
        expect(typeof feature.voco).toBe('boolean');
        expect(typeof feature.competitor).toBe('boolean');
      }
    }
  });
});

describe('SEO Data Layer — INTEGRATIONS', () => {
  test('has at least 1 item', () => {
    expect(INTEGRATIONS.length).toBeGreaterThanOrEqual(1);
  });

  test('each item has slug and toolName (strings)', () => {
    for (const integration of INTEGRATIONS) {
      expect(typeof integration.slug).toBe('string');
      expect(typeof integration.toolName).toBe('string');
    }
  });

  test('each item has useCases (array)', () => {
    for (const integration of INTEGRATIONS) {
      expect(Array.isArray(integration.useCases)).toBe(true);
      expect(integration.useCases.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('each item has ctaHeading (string)', () => {
    for (const integration of INTEGRATIONS) {
      expect(typeof integration.ctaHeading).toBe('string');
    }
  });
});

describe('SEO Data Layer — GLOSSARY_TERMS', () => {
  test('has at least 1 item', () => {
    expect(GLOSSARY_TERMS.length).toBeGreaterThanOrEqual(1);
  });

  test('each item has slug and term (strings)', () => {
    for (const term of GLOSSARY_TERMS) {
      expect(typeof term.slug).toBe('string');
      expect(typeof term.term).toBe('string');
    }
  });

  test('each item has definition (string)', () => {
    for (const term of GLOSSARY_TERMS) {
      expect(typeof term.definition).toBe('string');
      expect(term.definition.length).toBeGreaterThan(0);
    }
  });

  test('each item has faqItems (array of objects with q and a)', () => {
    for (const term of GLOSSARY_TERMS) {
      expect(Array.isArray(term.faqItems)).toBe(true);
      expect(term.faqItems.length).toBeGreaterThanOrEqual(1);
      for (const faq of term.faqItems) {
        expect(typeof faq.q).toBe('string');
        expect(typeof faq.a).toBe('string');
      }
    }
  });
});
