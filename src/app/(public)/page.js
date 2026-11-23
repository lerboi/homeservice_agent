import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import { LiveCallDemo } from '@/components/marketing/LiveCallDemo';
import {
  BackendsSection, ControlSection, DemoSection, FaqSection, FinalCtaSection, HowItWorksSection, UseCasesSection,
} from '@/components/marketing/LandingSections';
import { Container, Eyebrow, Lede, PageTitle } from '@/components/marketing/primitives';
import { FAQ_ITEMS } from '@/data/faq';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from '@/data/site';

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

export default function HomePage() {
  return (
    <>
      {SCHEMA.map((schema) => (
        <SchemaMarkup key={schema['@type']} schema={schema} />
      ))}

      {/* Hero */}
      <section className="bg-mk-paper pb-16 pt-28 text-mk-ink md:pb-24 md:pt-36">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <div>
              <Eyebrow>Voice agents for the systems you already run</Eyebrow>
              <PageTitle className="mt-5">{TAGLINE}</PageTitle>
              <Lede className="mt-6 max-w-xl">
                Voco answers the call, understands what the caller wants, and does the work in your
                systems: books the appointment, schedules the task, creates the record.
              </Lede>
              <AuthAwareCTA className="mt-9" />
            </div>
            <LiveCallDemo />
          </div>
        </Container>
      </section>

      <DemoSection />
      <HowItWorksSection />
      <UseCasesSection />
      <BackendsSection />
      <ControlSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
