import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DemoCTA } from '@/components/landing/DemoCTA';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import { CallAndLog } from '@/components/marketing/CallAndLog';
import { FinalCtaSection } from '@/components/marketing/LandingSections';
import { Container, Eyebrow, Lede, PageTitle, Section, SectionHeader } from '@/components/marketing/primitives';
import { getIntegration } from '@/data/integrations';
import { SITE_URL, pageMetadata } from '@/data/site';
import { USE_CASES, getUseCase } from '@/data/use-cases';

export async function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const useCase = getUseCase(slug);
  if (!useCase) return { title: 'Not found | Voco' };
  return pageMetadata({
    title: `${useCase.title} by voice | Voco`,
    description: useCase.summary,
    path: `/use-cases/${useCase.slug}`,
    ogTitle: useCase.headline,
    ogType: 'USE CASE',
  });
}

export default async function UseCasePage({ params }) {
  const { slug } = await params;
  const useCase = getUseCase(slug);
  if (!useCase) notFound();

  const integrations = useCase.integrations.map(getIntegration).filter(Boolean);
  const others = USE_CASES.filter((u) => u.slug !== useCase.slug);

  return (
    <>
      <SchemaMarkup
        schema={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Use cases', item: `${SITE_URL}/use-cases` },
            { '@type': 'ListItem', position: 2, name: useCase.title, item: `${SITE_URL}/use-cases/${useCase.slug}` },
          ],
        }}
      />

      <section className="border-b border-mk-line bg-mk-paper pb-16 pt-32 text-mk-ink md:pb-20 md:pt-40">
        <Container>
          <Link href="/use-cases" className="inline-flex items-center gap-1.5 text-sm text-mk-muted hover:text-mk-ink">
            <ArrowLeft className="size-3.5" /> Use cases
          </Link>
          <div className="mt-8 grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <div>
              <Eyebrow>{useCase.title}</Eyebrow>
              <PageTitle className="mt-5 lg:text-6xl">{useCase.headline}</PageTitle>
              <Lede className="mt-6">{useCase.summary}</Lede>
              <DemoCTA className="mt-9" />
            </div>
            <CallAndLog call={useCase.call} log={useCase.log} />
          </div>
        </Container>
      </section>

      <Section tone="white">
        <SectionHeader eyebrow="What the agent does" title="Step by step." />
        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {useCase.steps.map((step, i) => (
            <li key={step.title} className="border-t border-mk-ink pt-5">
              <p className="font-code text-xs text-mk-signal-deep">0{i + 1}</p>
              <h3 className="mt-3 font-display text-xl font-medium tracking-[-0.01em]">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="paper" bordered>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <SectionHeader
            eyebrow="Systems"
            title="Where the work lands."
            lede="We connect the agent to your systems during setup. These are the ones this use case most often touches."
          />
          <ul className="flex flex-wrap content-start gap-2.5">
            {integrations.map((integration) => (
              <li key={integration.slug}>
                <Link
                  href={`/integrations/${integration.slug}`}
                  className="inline-flex h-10 items-center rounded-full border border-mk-ink/15 bg-white px-4 text-sm transition-colors hover:border-mk-ink/50"
                >
                  {integration.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="white" bordered>
        <h2 className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">Other use cases</h2>
        <ul className="mt-6 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {others.map((other) => (
            <li key={other.slug} className="border-t border-mk-line">
              <Link href={`/use-cases/${other.slug}`} className="group flex items-baseline justify-between gap-4 py-4">
                <span className="font-display text-lg font-medium tracking-[-0.01em] group-hover:text-mk-signal-deep">{other.title}</span>
                <span className="hidden text-right text-sm text-mk-muted md:block">{other.short}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <FinalCtaSection />
    </>
  );
}
