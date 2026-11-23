import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { FinalCtaSection } from '@/components/marketing/LandingSections';
import { Icon } from '@/components/marketing/icons';
import { ButtonLink, Em, Eyebrow, PageHero, Section } from '@/components/marketing/primitives';
import { AGENT_JOBS } from '@/data/agent';
import { PRODUCTS, pageMetadata } from '@/data/site';
import { EXTRA_CAPABILITIES, USE_CASES } from '@/data/use-cases';

export const metadata = pageMetadata({
  title: 'Use cases | Voco',
  description:
    'What Voco does for a business. Voco Voice books appointments, takes leads, schedules callbacks and looks up orders on a call. Voco Agent handles reviews, email, search, the calendar and routine support from a message.',
  path: '/use-cases',
  ogTitle: 'The work you can hand over.',
  ogType: 'USE CASES',
});

export default function UseCasesPage() {
  return (
    <>
      <PageHero
        eyebrow="Use cases"
        title="The work you can hand over."
        lede="Some of it arrives as a phone call from a customer. Some of it sits in your inbox, your reviews and your calendar. Either way it ends with the job done in your systems."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="#voice" variant="primary" size="lg">
            On a call <ArrowDown className="size-4" />
          </ButtonLink>
          <ButtonLink href="#agent" variant="spark" size="lg">
            From a message <ArrowDown className="size-4" />
          </ButtonLink>
        </div>
      </PageHero>

      {/* Voco Voice */}
      <Section tone="white" id="voice">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <Eyebrow className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-mk-signal-deep" />
              {PRODUCTS.voice.name}
            </Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-5xl">
              Whatever callers <Em tone="signal-deep">ring you to get done.</Em>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-mk-muted">
              Each of these is a conversation that ends with a change in one of your systems.
            </p>
          </div>
          <ButtonLink href={PRODUCTS.voice.href} variant="secondary">
            About {PRODUCTS.voice.name} <ArrowRight className="size-4" />
          </ButtonLink>
        </div>

        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <li key={useCase.slug}>
              <Link
                href={`/use-cases/${useCase.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-mk-line bg-white p-6 transition-colors hover:border-mk-signal sm:p-7"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-mk-signal-wash text-mk-signal-deep">
                  <Icon name={useCase.icon} className="size-5" />
                </span>
                <h3 className="mt-5 flex items-center gap-1.5 font-display text-2xl font-semibold tracking-[-0.02em]">
                  {useCase.title}
                  <ArrowUpRight className="size-4 text-mk-faint transition-colors group-hover:text-mk-ink" aria-hidden="true" />
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{useCase.summary}</p>
              </Link>
            </li>
          ))}
          <li className="rounded-2xl border border-mk-signal/40 bg-mk-signal-wash p-6 sm:p-7">
            <h3 className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-signal-deep">On every call</h3>
            <ul className="mt-5 space-y-4">
              {EXTRA_CAPABILITIES.map((capability) => (
                <li key={capability.title} className="flex gap-3">
                  <Icon name={capability.icon} className="mt-0.5 size-4 shrink-0 text-mk-signal-deep" />
                  <p className="text-[15px] leading-snug">
                    <span className="font-medium">{capability.title}.</span>{' '}
                    <span className="text-mk-ink/70">{capability.short}</span>
                  </p>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </Section>

      {/* Voco Agent */}
      <Section tone="paper" id="agent" bordered>
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <Eyebrow tone="spark" className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-mk-spark-deep" />
              {PRODUCTS.agent.name}
            </Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-5xl">
              The jobs you would <Em tone="spark-deep">rather not do yourself.</Em>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-mk-muted">
              Message it on WhatsApp, Telegram, Slack or email. Under each job is the kind of thing you would type.
            </p>
          </div>
          <ButtonLink href={PRODUCTS.agent.href} variant="secondary">
            About {PRODUCTS.agent.name} <ArrowRight className="size-4" />
          </ButtonLink>
        </div>

        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENT_JOBS.map((job) => (
            <li key={job.id}>
              <Link
                href={`${PRODUCTS.agent.href}#jobs`}
                className="group flex h-full flex-col rounded-2xl border border-mk-line bg-white p-6 transition-colors hover:border-mk-spark sm:p-7"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-mk-spark-wash text-mk-spark-deep">
                  <Icon name={job.icon} className="size-5" />
                </span>
                <h3 className="mt-5 flex items-center gap-1.5 font-display text-2xl font-semibold tracking-[-0.02em]">
                  {job.title}
                  <ArrowUpRight className="size-4 text-mk-faint transition-colors group-hover:text-mk-ink" aria-hidden="true" />
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{job.body}</p>
                <p className="mt-auto pt-6">
                  <span className="inline-block rounded-2xl rounded-bl-md bg-mk-ink px-3.5 py-2 text-[13.5px] leading-snug text-white">
                    {job.say}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <FinalCtaSection
        title="Not on the list?"
        lede="If a system of yours can do it, Voco can probably do it for you, on a call or from a message. Tell us what it is."
      />
    </>
  );
}
