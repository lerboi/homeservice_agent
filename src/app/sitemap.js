import { BLOG_POSTS } from '@/data/blog';
import { PERSONAS } from '@/data/personas';
import { COMPARISONS } from '@/data/comparisons';
import { INTEGRATIONS } from '@/data/integrations';
import { GLOSSARY_TERMS } from '@/data/glossary';

const BASE_URL = 'https://voco.live';

export default function sitemap() {
  const staticRoutes = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/for`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/compare`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/integrations`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/glossary`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];

  const blogRoutes = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const personaRoutes = PERSONAS.map((p) => ({
    url: `${BASE_URL}/for/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const comparisonRoutes = COMPARISONS.map((c) => ({
    url: `${BASE_URL}/compare/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const integrationRoutes = INTEGRATIONS.map((i) => ({
    url: `${BASE_URL}/integrations/${i.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const glossaryRoutes = GLOSSARY_TERMS.map((term) => ({
    url: `${BASE_URL}/glossary/${term.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...blogRoutes,
    ...personaRoutes,
    ...comparisonRoutes,
    ...integrationRoutes,
    ...glossaryRoutes,
  ];
}
