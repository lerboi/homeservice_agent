/**
 * Tests for the SchemaMarkup JSON-LD pattern.
 * Since Jest in this project does not have a JSX Babel transform,
 * we test the schema serialization logic directly and validate
 * the source file for correctness via file inspection.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Mirror the core logic of SchemaMarkup: JSON.stringify the schema
function serializeSchema(schema) {
  return JSON.stringify(schema);
}

function buildScriptTag(schema) {
  return `<script type="application/ld+json">${serializeSchema(schema)}</script>`;
}

describe('SchemaMarkup JSON-LD serialization', () => {
  test('produces a script tag with type="application/ld+json"', () => {
    const schema = { '@type': 'WebPage', name: 'Test Page' };
    const html = buildScriptTag(schema);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('<script');
    expect(html).toContain('</script>');
  });

  test('serialized JSON is valid and contains @type', () => {
    const schema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] };
    const html = buildScriptTag(schema);
    const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const json = JSON.parse(match[1]);
    expect(json['@type']).toBe('FAQPage');
  });

  test('FAQPage schema: mainEntity array is preserved in serialization', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Voco?',
          acceptedAnswer: { '@type': 'Answer', text: 'AI receptionist for contractors.' },
        },
      ],
    };
    const html = buildScriptTag(schema);
    const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    const json = JSON.parse(match[1]);
    expect(json['@type']).toBe('FAQPage');
    expect(json.mainEntity).toHaveLength(1);
    expect(json.mainEntity[0]['@type']).toBe('Question');
  });

  test('WebPage schema: @type is WebPage', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Voco AI Receptionist',
      url: 'https://voco.live',
    };
    const html = buildScriptTag(schema);
    const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    const json = JSON.parse(match[1]);
    expect(json['@type']).toBe('WebPage');
    expect(json.url).toBe('https://voco.live');
  });
});

describe('SchemaMarkup component source validation', () => {
  let content;

  beforeAll(() => {
    const filePath = resolve('./src/components/SchemaMarkup.jsx');
    content = readFileSync(filePath, 'utf-8');
  });

  test('SchemaMarkup.jsx file exists', () => {
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
  });

  test('has no "use client" directive (must be a Server Component)', () => {
    expect(content).not.toContain("'use client'");
    expect(content).not.toContain('"use client"');
  });

  test('exports SchemaMarkup function', () => {
    expect(content).toContain('SchemaMarkup');
    expect(content).toContain('export');
  });

  test('uses application/ld+json script tag', () => {
    expect(content).toContain('application/ld+json');
  });

  test('uses dangerouslySetInnerHTML with JSON.stringify', () => {
    expect(content).toContain('dangerouslySetInnerHTML');
    expect(content).toContain('JSON.stringify');
  });
});
