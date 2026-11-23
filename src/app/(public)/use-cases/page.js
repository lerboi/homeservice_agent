import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { DemoCTA } from '@/components/landing/DemoCTA';
import { FinalCtaSection } from '@/components/marketing/LandingSections';
import { Icon } from '@/components/marketing/icons';
import { PageHero, Section } from '@/components/marketing/primitives';
import { pageMetadata } from '@/data/site';
import { EXTRA_CAPABILITIES, USE_CASES } from '@/data/use-cases';

export const metadata = pageMetadata({
  title: 'Use cases | Voco',
  description:
    'What a Voco voice agent does on a call: books appointments, takes leads into your CRM, schedules callbacks, looks up orders and covers the hours you are closed.',
  path: '/use-cases',
  ogTitle: 'Whatever callers ring you to get done.',
  ogType: 'USE CASES',
});

export default function UseCasesPage() {
  return (
    <>
      <PageHero
        eyebrow="Use cases"
        title="Whatever callers ring you to get done."
        lede="Each of these is a conversation that ends with a change in one of your systems. Start with one; add the rest as you see what callers ask for."
      >
        <DemoCTA />
      </PageHero>

      <Section tone="white">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-mk-line bg-mk-line md:grid-cols-2">
          {USE_CASES.map((useCase) => (
            <li key={useCase.slug} className="bg-white">
              <Link href={`/use-cases/${useCase.slug}`} className="group flex h-full flex-col p-7 transition-colors hover:bg-mk-paper sm:p-9">
                <Icon name={useCase.icon} className="size-6 text-mk-signal-deep" />
                <h2 className="mt-5 flex items-center gap-1.5 font-display text-2xl font-medium tracking-[-0.02em]">
                  {useCase.title}
                  <ArrowUpRight className="size-4 text-mk-faint transition-colors group-hover:text-mk-ink" />
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{useCase.summary}</p>
              </Link>
            </li>
          ))}
          <li className="bg-mk-paper p-7 sm:p-9">
            <h2 className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">On every call</h2>
            <ul className="mt-5 space-y-4">
              {EXTRA_CAPABILITIES.map((capability) => (
                <li key={capability.title} className="flex gap-3">
                  <Icon name={capability.icon} className="mt-0.5 size-4 shrink-0 text-mk-signal-deep" />
                  <p className="text-[15px] leading-snug">
                    <span className="font-medium">{capability.title}.</span>{' '}
                    <span className="text-mk-muted">{capability.short}</span>
                  </p>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </Section>

      <FinalCtaSection
        title="Not on the list?"
        lede="If callers ask for it and a system of yours can do it, the agent can probably do it by voice. Tell us what it is."
      />
    </>
  );
}
