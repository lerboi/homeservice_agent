import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DemoCTA } from '@/components/landing/DemoCTA';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import { AgentChatDemo } from '@/components/marketing/AgentChatDemo';
import { LiveCallDemo } from '@/components/marketing/LiveCallDemo';
import {
  BackendsSection, DemoSection, FaqSection, FinalCtaSection, ProductsSection, SetupSection,
} from '@/components/marketing/LandingSections';
import { Container, Em } from '@/components/marketing/primitives';
import { FAQ_ITEMS } from '@/data/faq';
import { PRODUCTS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/data/site';

const SCHEMA = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    legalName: 'Voco Private Limited',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logos/VOCO%20Logo%20V1.png`,
    description: SITE_DESCRIPTION,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  },
];

/** One product's window in the hero: a coloured label row above its illustration. */
function ProductWindow({ product, does, children }) {
  const dot = product.tone === 'spark' ? 'bg-mk-spark' : 'bg-mk-signal';
  const text = product.tone === 'spark' ? 'text-mk-spark' : 'text-mk-signal';
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className={`flex items-center gap-2 font-code text-[11px] uppercase tracking-[0.16em] ${text}`}>
            <span className={`size-1.5 rounded-full ${dot}`} />
            {product.name}
          </p>
          <p className="mt-1 font-display text-xl font-medium tracking-[-0.02em] text-white">{does}</p>
        </div>
        <Link
          href={product.href}
          className="mb-0.5 inline-flex shrink-0 items-center gap-1 text-sm text-white/60 transition-colors hover:text-white"
        >
          See how <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {children}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {SCHEMA.map((schema) => (
        <SchemaMarkup key={schema['@type']} schema={schema} />
      ))}

      {/* Hero: both products, side by side, neither first among them */}
      <section className="relative overflow-hidden bg-mk-ink pb-20 pt-32 text-white md:pb-28 md:pt-40">
        <div className="mk-grid-ink pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-40 top-24 size-[520px] rounded-full bg-mk-signal/20 blur-[140px]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-40 top-56 size-[520px] rounded-full bg-mk-spark/15 blur-[140px]" aria-hidden="true" />

        <Container size="wide" className="relative">
          <div className="grid items-end gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
            <div>
              <p className="font-code text-[11px] uppercase tracking-[0.16em] text-white/55">
                <span className="text-mk-signal">Voice agents</span>
                <span className="mx-2 text-white/30">+</span>
                <span className="text-mk-spark">AI agents</span>
                <span className="mx-2 text-white/30">/</span>
                built into your business
              </p>
              <h1 className="mt-6 font-display text-[3.25rem] font-semibold leading-[0.95] tracking-[-0.045em] sm:text-7xl lg:text-[6.75rem]">
                AI that <Em className="text-white">does</Em>
                <br />
                the work.
              </h1>
            </div>
            <div className="lg:pb-3">
              <p className="text-lg leading-relaxed text-white/70">
                Voco puts two AI workers inside the tools your business already runs. One answers
                your calls and books, schedules and records. The other takes a message from you and
                handles reviews, email, search and the calendar.
              </p>
              <DemoCTA onInk className="mt-7" />
            </div>
          </div>

          <div className="mt-16 grid gap-10 lg:mt-20 lg:grid-cols-2 lg:gap-8">
            <ProductWindow product={PRODUCTS.voice} does="Answers the call and does what the caller asked.">
              <LiveCallDemo />
            </ProductWindow>
            <ProductWindow product={PRODUCTS.agent} does="Answers you, then does what you asked.">
              <AgentChatDemo />
            </ProductWindow>
          </div>
        </Container>
      </section>

      <ProductsSection />
      <DemoSection />
      <BackendsSection />
      <SetupSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
