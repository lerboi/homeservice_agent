/**
 * Public site after the 2026-11 rebrand ("voice integration for any backend").
 *
 * These tests hold the things that are easy to break without noticing:
 *  - the data the pages are generated from is complete and internally linked
 *  - the sitemap lists exactly the routes that exist; retired routes redirect
 *  - no public page talks about trades, quotes prices, links to self-serve
 *    signup or carries invented social proof
 *  - the plan data that billing depends on is still where billing imports it
 *
 * Source checks read files as text: no rendering, Jest node environment.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import sitemapFn from '../../src/app/sitemap.js';
import { FAQ_ITEMS, FAQ_CHAT_SUGGESTIONS } from '../../src/data/faq.js';
import {
  INTEGRATIONS, INTEGRATION_GROUPS, getIntegration, integrationsByGroup,
} from '../../src/data/integrations.js';
import { BOOK_DEMO_HREF, NAV_LINKS, SITE_URL, TAGLINE, pageMetadata } from '../../src/data/site.js';
import { EXTRA_CAPABILITIES, USE_CASES, getUseCase } from '../../src/data/use-cases.js';
import { getPublicKnowledge } from '../../src/lib/public-chatbot-knowledge/index.js';

const read = (p) => readFileSync(p, 'utf8');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const PUBLIC_DIR = 'src/app/(public)';
const PUBLIC_SOURCES = [
  ...walk(PUBLIC_DIR),
  ...walk('src/components/marketing'),
  ...walk('src/components/landing'),
  ...walk('src/app/components/landing'),
  'src/data/site.js',
  'src/data/faq.js',
  'src/data/use-cases.js',
  'src/data/integrations.js',
].filter((f) => /\.(js|jsx)$/.test(f) && !f.replace(/\\/g, '/').endsWith('pricing/pricingData.js'));

// Legal documents keep their own wording until the owner reviews them.
const COPY_SOURCES = PUBLIC_SOURCES.filter((f) => !/(privacy|terms)[\\/]page\.js$/.test(f));

describe('use cases data', () => {
  it('has the five task-based use cases', () => {
    expect(USE_CASES.map((u) => u.slug)).toEqual([
      'appointment-booking',
      'lead-intake',
      'task-and-callback-scheduling',
      'order-and-account-lookup',
      'after-hours-coverage',
    ]);
  });

  it.each(USE_CASES.map((u) => [u.slug, u]))('%s is complete', (_slug, useCase) => {
    for (const field of ['title', 'short', 'headline', 'summary', 'icon']) {
      expect(typeof useCase[field]).toBe('string');
      expect(useCase[field].length).toBeGreaterThan(3);
    }
    expect(useCase.call.length).toBeGreaterThanOrEqual(4);
    expect(useCase.call.every((l) => ['caller', 'agent'].includes(l.who) && l.text)).toBe(true);
    expect(useCase.call[0].who).toBe('caller');
    expect(useCase.log.length).toBeGreaterThanOrEqual(3);
    expect(useCase.steps).toHaveLength(4);
  });

  it('links only to integrations that exist', () => {
    for (const useCase of USE_CASES) {
      for (const slug of useCase.integrations) {
        expect(getIntegration(slug)).not.toBeNull();
      }
    }
  });

  it('uses only icons the icon map provides', () => {
    const icons = read('src/components/marketing/icons.js');
    for (const item of [...USE_CASES, ...EXTRA_CAPABILITIES]) {
      expect(icons).toContain(item.icon);
    }
  });

  it('looks up by slug', () => {
    expect(getUseCase('lead-intake').title).toBe('Lead intake');
    expect(getUseCase('plumber')).toBeNull();
  });
});

describe('integrations data', () => {
  it('has the six groups', () => {
    expect(INTEGRATION_GROUPS.map((g) => g.id)).toEqual([
      'calendars', 'crm', 'field', 'messaging', 'payments', 'automation',
    ]);
  });

  it('every integration is complete and belongs to a group', () => {
    const groupIds = new Set(INTEGRATION_GROUPS.map((g) => g.id));
    for (const item of INTEGRATIONS) {
      expect(item.slug).toMatch(/^[a-z0-9-]+$/);
      expect(item.name.length).toBeGreaterThan(1);
      expect(item.summary.length).toBeGreaterThan(20);
      expect(item.actions.length).toBeGreaterThanOrEqual(3);
      expect(groupIds.has(item.group)).toBe(true);
    }
  });

  it('has unique slugs and no empty group', () => {
    expect(new Set(INTEGRATIONS.map((i) => i.slug)).size).toBe(INTEGRATIONS.length);
    for (const group of integrationsByGroup()) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('includes the calendars that are built in and the custom API', () => {
    for (const slug of ['google-calendar', 'outlook-calendar', 'rest-api', 'webhooks']) {
      expect(getIntegration(slug)).not.toBeNull();
    }
  });

  it('does not promise self-serve setup', () => {
    const text = JSON.stringify(INTEGRATIONS).toLowerCase();
    for (const phrase of ['one-click', 'one click', 'in 5 minutes', 'self-serve', 'install in', 'coming soon']) {
      expect(text).not.toContain(phrase);
    }
  });
});

describe('site constants', () => {
  it('carries the positioning', () => {
    expect(TAGLINE).toBe('Give your backend a voice.');
    expect(BOOK_DEMO_HREF).toBe('/contact?type=sales');
  });

  it('nav links to Product, Use cases, Integrations, Demo, Pricing', () => {
    expect(NAV_LINKS.map((l) => l.label)).toEqual(['Product', 'Use cases', 'Integrations', 'Demo', 'Pricing']);
  });

  it('builds page metadata with a canonical path and an OG image', () => {
    const meta = pageMetadata({ title: 'T | Voco', description: 'D', path: '/x', ogTitle: 'Hello there', ogType: 'X' });
    expect(meta.alternates.canonical).toBe('/x');
    expect(meta.openGraph.images[0].url).toBe('/og?title=Hello%20there&type=X');
    expect(meta.twitter.card).toBe('summary_large_image');
  });
});

describe('FAQ', () => {
  it('has answers and does not quote prices', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);
    for (const item of FAQ_ITEMS) {
      expect(item.q.endsWith('?')).toBe(true);
      expect(item.a.length).toBeGreaterThan(40);
      expect(item.a).not.toMatch(/\$\d/);
    }
    expect(FAQ_CHAT_SUGGESTIONS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('sitemap', () => {
  const entries = sitemapFn();
  const urls = entries.map((e) => e.url);

  it('lists the home page first with priority 1', () => {
    expect(entries[0]).toMatchObject({ url: SITE_URL, priority: 1.0 });
  });

  it('lists every static page', () => {
    for (const path of ['/demo', '/use-cases', '/integrations', '/pricing', '/about', '/contact', '/privacy', '/terms']) {
      expect(urls).toContain(`${SITE_URL}${path}`);
    }
  });

  it('lists every use case and integration page', () => {
    for (const u of USE_CASES) expect(urls).toContain(`${SITE_URL}/use-cases/${u.slug}`);
    for (const i of INTEGRATIONS) expect(urls).toContain(`${SITE_URL}/integrations/${i.slug}`);
    expect(entries).toHaveLength(9 + USE_CASES.length + INTEGRATIONS.length);
  });

  it('lists no retired route', () => {
    for (const url of urls) {
      expect(url).not.toMatch(/\/(blog|glossary|compare|for)(\/|$)/);
    }
  });

  it('every entry is well formed', () => {
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(typeof entry.changeFrequency).toBe('string');
      expect(entry.priority).toBeGreaterThan(0);
    }
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('routes', () => {
  it.each([
    'page.js', 'demo/page.js', 'pricing/page.js', 'about/page.js', 'contact/page.js',
    'use-cases/page.js', 'use-cases/[slug]/page.js', 'integrations/page.js', 'integrations/[tool]/page.js',
    'privacy/page.js', 'terms/page.js',
  ])('%s exists', (file) => {
    expect(existsSync(join(PUBLIC_DIR, file))).toBe(true);
  });

  it.each(['blog', 'glossary', 'compare', 'for'])('/%s is retired', (dir) => {
    expect(existsSync(join(PUBLIC_DIR, dir))).toBe(false);
  });

  it('the old /demo stub outside the public layout is gone', () => {
    expect(existsSync('src/app/demo/page.js')).toBe(false);
  });

  it('retired routes redirect permanently', () => {
    const config = read('next.config.js');
    for (const source of ['/blog', '/blog/:path*', '/glossary', '/glossary/:path*', '/compare', '/compare/:path*']) {
      expect(config).toContain(`{ source: '${source}', destination: '/', permanent: true }`);
    }
    expect(config).toContain("{ source: '/for', destination: '/use-cases', permanent: true }");
    expect(config).toContain("{ source: '/for/:path*', destination: '/use-cases', permanent: true }");
  });

  it('keeps the microphone permission the admin call pages need', () => {
    expect(read('next.config.js')).toContain("value: 'camera=(), microphone=(self), geolocation=()'");
  });
});

describe('landing page', () => {
  const page = read('src/app/(public)/page.js');
  const sections = read('src/components/marketing/LandingSections.jsx');

  it('renders the eight sections in order', () => {
    const order = [
      '<LiveCallDemo />', '<DemoSection />', '<HowItWorksSection />', '<UseCasesSection />',
      '<BackendsSection />', '<ControlSection />', '<FaqSection />', '<FinalCtaSection />',
    ].map((tag) => page.indexOf(tag));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('leads with the tagline and both calls to action', () => {
    expect(page).toContain('{TAGLINE}');
    expect(page).toContain('<AuthAwareCTA');
    const cta = read('src/components/landing/AuthAwareCTA.js');
    expect(cta).toContain('Book a demo');
    expect(cta).toContain('Watch the demo');
    expect(cta).toContain('BOOK_DEMO_HREF');
  });

  it('publishes Organization, SoftwareApplication and FAQ structured data', () => {
    for (const type of ['Organization', 'SoftwareApplication', 'FAQPage']) {
      expect(page).toContain(`'@type': '${type}'`);
    }
  });

  it('gives each section an anchor the nav and footer can link to', () => {
    for (const id of ['demo', 'how-it-works', 'use-cases', 'backends', 'control', 'faq']) {
      expect(sections).toContain(`id="${id}"`);
    }
  });

  it('shows a placeholder, not a dead player, until the recording exists', () => {
    const video = read('src/components/marketing/DemoVideo.jsx');
    expect(video).toContain('if (DEMO_VIDEO.src)');
    expect(video).toContain('data-demo-placeholder');
    expect(read('src/data/site.js')).toMatch(/DEMO_VIDEO = \{\s*src: null/);
  });

  it('the hero animation has a still state for reduced motion', () => {
    const hero = read('src/components/marketing/LiveCallDemo.jsx');
    expect(hero).toContain('prefers-reduced-motion: reduce');
    expect(hero).toContain('useState(SCRIPT.length)');
  });
});

describe('public copy', () => {
  const FORBIDDEN = [
    [/home[- ]service/i, 'home-service positioning'],
    [/\b(plumb(er|ing)|hvac|electrician|handyman|roofer|contractor)s?\b/i, 'a trade'],
    [/receptionist/i, '"receptionist"'],
    [/voicemail again|missed[- ]call revenue|lose a job/i, 'the old missed-call pitch'],
    [/5-minute setup|in 5 minutes|free trial|14-day/i, 'self-serve signup claims'],
    [/trusted by|500\+|testimonial/i, 'invented social proof'],
    [/\$\s?\d{2,}/, 'a price'],
    [/coming soon/i, '"coming soon"'],
    [/#F97316|#C2410C|#EA580C/i, 'the old orange'],
  ];

  it.each(COPY_SOURCES.map((f) => [f.replace(/\\/g, '/')]))('%s is on the new positioning', (file) => {
    const source = read(file);
    for (const [pattern, label] of FORBIDDEN) {
      const match = source.match(pattern);
      expect(match ? `${label}: "${match[0]}"` : null).toBeNull();
    }
  });

  it('no public page links to self-serve signup', () => {
    for (const file of PUBLIC_SOURCES) {
      const source = read(file);
      expect(source).not.toMatch(/href=["'{`]+\/onboarding/);
      expect(source).not.toMatch(/auth\/signin\?mode=signup|\/auth\/signup/);
    }
  });

  it('the sign-in panel no longer claims customers it does not have', () => {
    const signin = read('src/app/auth/signin/page.js');
    expect(signin).not.toMatch(/500\+|Trusted by|home service/i);
    expect(signin).toContain('Give your backend a voice');
  });

  it('root metadata describes the new product', () => {
    const layout = read('src/app/layout.js');
    expect(layout).toContain('a voice agent that works in your systems');
    expect(layout).not.toMatch(/Receptionist|Home Service/);
  });
});

describe('pricing', () => {
  it('the public page is talk-to-us and shows no plan table', () => {
    const page = read('src/app/(public)/pricing/page.js');
    expect(page).toContain('<AuthAwareCTA');
    expect(page).not.toMatch(/PRICING_TIERS|PricingTiers|ROICalculator|ComparisonTable/);
  });

  it('plan data stays where billing, onboarding and usage import it', () => {
    expect(existsSync('src/app/(public)/pricing/pricingData.js')).toBe(true);
    for (const importer of [
      'src/app/api/usage/route.js',
      'src/app/dashboard/more/billing/page.js',
      'src/components/billing/UpgradeCheckoutCards.js',
      'src/components/onboarding/PlanSelectionCards.jsx',
    ]) {
      expect(read(importer)).toContain("from '@/app/(public)/pricing/pricingData'");
    }
  });
});

describe('public chatbot', () => {
  const route = read('src/app/api/public-chat/route.js');

  it('is told not to quote prices or offer self-serve signup', () => {
    expect(route).toContain('Quote prices, plan names, call allowances or trial lengths');
    expect(route).toContain('Offer or mention self-serve signup or a free trial');
    expect(route).not.toMatch(/\$\d+\/mo|home service|plumbers/i);
  });

  it('knowledge docs carry no prices or trade wording', () => {
    const dir = 'src/lib/public-chatbot-knowledge';
    const docs = readdirSync(dir).filter((f) => f.endsWith('.md'));
    expect(docs.sort()).toEqual(
      ['contact.md', 'faq.md', 'features.md', 'how-it-works.md', 'integrations.md', 'overview.md', 'pricing.md'],
    );
    for (const doc of docs) {
      const text = read(join(dir, doc));
      expect(text).not.toMatch(/\$\d/);
      expect(text).not.toMatch(/plumb|hvac|electrician|handyman|receptionist|14-day|5-minute/i);
    }
  });

  it('serves the doc for the page the visitor is on, including sub-pages', async () => {
    expect(await getPublicKnowledge('hello', '/pricing')).toContain('# Voco pricing');
    expect(await getPublicKnowledge('hello', '/integrations/hubspot')).toContain('# Systems Voco works in');
    expect(await getPublicKnowledge('hello', '/use-cases/lead-intake')).toContain('# What Voco does');
    expect(await getPublicKnowledge('hello', '/somewhere-else')).toContain('a voice agent that works in your systems');
  });

  it('adds one keyword-matched doc', async () => {
    const text = await getPublicKnowledge('does it work with hubspot?', '/');
    expect(text).toContain('a voice agent that works in your systems');
    expect(text).toContain('# Systems Voco works in');
    expect(text.split('\n\n---\n\n')).toHaveLength(2);
  });
});
