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

/**
 * One product's window in the hero: a dark frame holding the product's name,
 * what it does, and its illustration. Both frames are the same size and sit
 * side by side so neither product leads.
 */
function ProductWindow({ product, does, children }) {
  const spark = product.tone === 'spark';
  return (
    <div className="flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-mk-ink-soft p-2 shadow-[0_40px_80px_-40px_rgba(11,15,20,0.7)]">
      <div className="flex items-center justify-between gap-4 px-3 pb-3 pt-2.5">
        <div className="min-w-0">
          <p className={`flex items-center gap-2 font-code text-[11px] uppercase tracking-[0.16em] ${spark ? 'text-mk-spark' : 'text-mk-signal'}`}>
            <span className={`size-1.5 rounded-full ${spark ? 'bg-mk-spark' : 'bg-mk-signal'}`} />
            {product.name}
          </p>
          <p className="mt-1 text-[15px] leading-snug text-white/80">{does}</p>
        </div>
        <Link
          href={product.href}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-[13px] font-medium text-white transition-colors hover:border-white/50"
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

      {/* Hero: centred statement, then both products side by side. The dark
          field stops short of the section so the two windows step down onto
          the light page below. */}
      <section className="relative bg-mk-paper text-white">
        <div data-nav-ink className="absolute inset-x-0 bottom-28 top-0 overflow-hidden bg-mk-ink sm:bottom-36" aria-hidden="true">
          <div className="mk-grid-ink absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]" />
          <div className="absolute bottom-0 left-[8%] h-[420px] w-[38%] rounded-full bg-mk-signal/20 blur-[130px]" />
          <div className="absolute bottom-0 right-[8%] h-[420px] w-[38%] rounded-full bg-mk-spark/[0.16] blur-[130px]" />
        </div>

        <Container className="relative pt-32 md:pt-44">
          <div className="mx-auto max-w-4xl text-center">
            <p className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 font-code text-[11px] uppercase tracking-[0.14em] text-white/60">
              <span className="flex items-center gap-1.5 text-mk-signal">
                <span className="size-1.5 rounded-full bg-mk-signal" />
                Voice agents
              </span>
              <span className="flex items-center gap-1.5 text-mk-spark">
                <span className="size-1.5 rounded-full bg-mk-spark" />
                AI agents
              </span>
              <span>built into your business</span>
            </p>
            <h1 className="mt-7 text-balance font-display text-[3.25rem] font-semibold leading-[0.95] tracking-[-0.045em] sm:text-7xl lg:text-[6.25rem]">
              AI that <Em tone="both">does</Em> the work.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-white/70">
              Voco puts two AI workers inside the tools your business already runs. One answers your
              calls and books, schedules and records. The other takes a message from you and handles
              reviews, email, search and the calendar.
            </p>
            <DemoCTA onInk className="mt-9 justify-center" />
          </div>

          <div className="mt-16 grid gap-5 lg:mt-20 lg:grid-cols-2">
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
