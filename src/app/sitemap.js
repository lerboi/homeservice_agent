import { INTEGRATIONS } from '@/data/integrations';
import { SITE_URL } from '@/data/site';
import { USE_CASES } from '@/data/use-cases';

export default function sitemap() {
  const now = new Date();
  const page = (path, changeFrequency, priority) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page('', 'weekly', 1.0),
    page('/voice', 'monthly', 0.9),
    page('/agent', 'monthly', 0.9),
    page('/demo', 'monthly', 0.9),
    page('/use-cases', 'monthly', 0.9),
    page('/integrations', 'monthly', 0.9),
    page('/pricing', 'monthly', 0.8),
    page('/about', 'monthly', 0.7),
    page('/contact', 'monthly', 0.7),
    page('/privacy', 'yearly', 0.3),
    page('/terms', 'yearly', 0.3),
    ...USE_CASES.map((u) => page(`/use-cases/${u.slug}`, 'monthly', 0.8)),
    ...INTEGRATIONS.map((i) => page(`/integrations/${i.slug}`, 'monthly', 0.6)),
  ];
}
