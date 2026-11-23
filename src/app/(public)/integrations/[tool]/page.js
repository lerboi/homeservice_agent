import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import { FinalCtaSection } from '@/components/marketing/LandingSections';
import { Card, Container, Eyebrow, Lede, PageTitle, Section, SectionHeader } from '@/components/marketing/primitives';
import { INTEGRATIONS, INTEGRATION_GROUPS, getIntegration } from '@/data/integrations';
import { SITE_URL, pageMetadata } from '@/data/site';
import { USE_CASES } from '@/data/use-cases';

export async function generateStaticParams() {
  return INTEGRATIONS.map((i) => ({ tool: i.slug }));
}

export async function generateMetadata({ params }) {
  const { tool } = await params;
  const item = getIntegration(tool);
  if (!item) return { title: 'Not found | Voco' };
  return pageMetadata({
    title: `${item.name} and Voco | Voice agent integration`,
    description: item.summary,
    path: `/integrations/${item.slug}`,
    ogTitle: `Voco + ${item.name}`,
    ogType: 'INTEGRATION',
  });
}

const SETUP = [
  { title: 'You tell us what callers need', body: 'Which requests should end in this system, and what the agent may do there.' },
  { title: 'We connect it', body: 'Our team sets up the connection with the access you approve, and nothing wider.' },
  { title: 'We test it together', body: 'Real calls against your data, before a customer ever reaches the agent.' },
];

export default async function IntegrationPage({ params }) {
  const { tool } = await params;
  const item = getIntegration(tool);
  if (!item) notFound();

  const group = INTEGRATION_GROUPS.find((g) => g.id === item.group);
  const siblings = INTEGRATIONS.filter((i) => i.group === item.group && i.slug !== item.slug);
  const useCases = USE_CASES.filter((u) => u.integrations.includes(item.slug));

  return (
    <>
      <SchemaMarkup
        schema={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Integrations', item: `${SITE_URL}/integrations` },
            { '@type': 'ListItem', position: 2, name: item.name, item: `${SITE_URL}/integrations/${item.slug}` },
          ],
        }}
      />

      <section className="border-b border-mk-line bg-mk-paper pb-16 pt-32 text-mk-ink md:pb-20 md:pt-40">
        <Container>
          <Link href="/integrations" className="inline-flex items-center gap-1.5 text-sm text-mk-muted hover:text-mk-ink">
            <ArrowLeft className="size-3.5" /> Integrations
          </Link>
          <div className="mt-8 grid items-start gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <div>
              <Eyebrow>{group?.title}</Eyebrow>
              <PageTitle className="mt-5 lg:text-6xl">Voco + {item.name}</PageTitle>
              <Lede className="mt-6">{item.summary}</Lede>
              <AuthAwareCTA className="mt-9" />
            </div>
            <Card className="p-6 sm:p-7">
              <h2 className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">
                What the agent does in {item.name}
              </h2>
              <ul className="mt-5 space-y-3.5">
                {item.actions.map((action) => (
                  <li key={action} className="flex gap-3 text-[15px] leading-snug">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-mk-signal/15 text-mk-signal-deep">
                      <Check className="size-2.5" strokeWidth={3.5} />
                    </span>
                    {action}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      <Section tone="white">
        <SectionHeader
          eyebrow="Getting connected"
          title="We set it up with you."
          lede={`There is nothing for you to build. Connecting ${item.name} is part of setup.`}
        />
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {SETUP.map((step, i) => (
            <li key={step.title} className="border-t border-mk-ink pt-5">
              <p className="font-code text-xs text-mk-signal-deep">0{i + 1}</p>
              <h3 className="mt-3 font-display text-xl font-medium tracking-[-0.01em]">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {(useCases.length > 0 || siblings.length > 0) && (
        <Section tone="paper" bordered>
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            {useCases.length > 0 && (
              <div>
                <h2 className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">Used for</h2>
                <ul className="mt-4">
                  {useCases.map((useCase) => (
                    <li key={useCase.slug} className="border-t border-mk-line">
                      <Link href={`/use-cases/${useCase.slug}`} className="block py-4 font-display text-lg font-medium tracking-[-0.01em] hover:text-mk-signal-deep">
                        {useCase.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {siblings.length > 0 && (
              <div>
                <h2 className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">Also in {group?.title.toLowerCase()}</h2>
                <ul className="mt-4 flex flex-wrap gap-2.5 border-t border-mk-line pt-5">
                  {siblings.map((sibling) => (
                    <li key={sibling.slug}>
                      <Link
                        href={`/integrations/${sibling.slug}`}
                        className="inline-flex h-10 items-center rounded-full border border-mk-ink/15 bg-white px-4 text-sm transition-colors hover:border-mk-ink/50"
                      >
                        {sibling.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      <FinalCtaSection
        title={`See it work in ${item.name}.`}
        lede="Bring a real request your callers make. We will show you the agent carrying it out."
      />
    </>
  );
}
