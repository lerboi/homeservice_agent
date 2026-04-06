/**
 * Validates the metadata generation pattern used by all 5 SEO page types.
 * This mirrors what generateMetadata() does in dynamic pages.
 */

const BASE_URL = 'https://voco.live';

function buildMetadata(title, slug, type, excerpt) {
  const pageTitle = `${title} | Voco`;
  const canonical = `${BASE_URL}/${type}/${slug}`;
  const ogImageUrl = `${BASE_URL}/og?title=${encodeURIComponent(title)}&type=${type.toUpperCase()}`;

  return {
    title: pageTitle,
    description: excerpt,
    alternates: {
      canonical,
    },
    openGraph: {
      title: pageTitle,
      description: excerpt,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

describe('SEO metadata generation pattern', () => {
  const meta = buildMetadata(
    'Why Every Plumber Needs an AI Receptionist',
    'ai-receptionist-for-plumbers',
    'blog',
    "You can't answer the phone while you're under a sink."
  );

  test('title follows {PageTitle} | Voco format', () => {
    expect(meta.title).toMatch(/\| Voco$/);
    expect(meta.title).toContain('Why Every Plumber Needs an AI Receptionist');
  });

  test('alternates.canonical matches https://voco.live/{type}/{slug}', () => {
    expect(meta.alternates.canonical).toBe(
      'https://voco.live/blog/ai-receptionist-for-plumbers'
    );
  });

  test('openGraph.images[0].url contains /og?title=', () => {
    expect(meta.openGraph.images[0].url).toContain('/og?title=');
  });

  test('openGraph.images[0].url contains encoded title', () => {
    expect(meta.openGraph.images[0].url).toContain(
      encodeURIComponent('Why Every Plumber Needs an AI Receptionist')
    );
  });

  test('description is set from excerpt', () => {
    expect(meta.description).toContain("under a sink");
  });

  test('robots allows index and follow', () => {
    expect(meta.robots.index).toBe(true);
    expect(meta.robots.follow).toBe(true);
  });

  test('works for persona type', () => {
    const personaMeta = buildMetadata(
      'Stop Losing Jobs to Voicemail',
      'plumber',
      'for',
      'Built for plumbers who are under a sink when the phone rings.'
    );
    expect(personaMeta.alternates.canonical).toBe('https://voco.live/for/plumber');
    expect(personaMeta.openGraph.images[0].url).toContain('type=FOR');
  });

  test('works for glossary type', () => {
    const glossaryMeta = buildMetadata(
      'AI Receptionist',
      'ai-receptionist',
      'glossary',
      'An AI receptionist answers phone calls on behalf of a business.'
    );
    expect(glossaryMeta.alternates.canonical).toBe(
      'https://voco.live/glossary/ai-receptionist'
    );
    expect(glossaryMeta.openGraph.images[0].url).toContain('type=GLOSSARY');
  });
});
