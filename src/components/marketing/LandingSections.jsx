/**
 * Landing-page sections below the hero (2026-11 rebrand). Server components.
 *
 * Order on the page: Demo, How it works, What it can do, Backends, Control
 * and reliability, FAQ, Final CTA. Copy rule: claim only what the product
 * does; numbers must be ones measured on the system.
 */
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, FileText, Languages, PhoneForwarded, SlidersHorizontal } from 'lucide-react';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { FAQChatWidget } from '@/app/components/landing/FAQChatWidget';
import { FAQ_ITEMS } from '@/data/faq';
import { integrationsByGroup } from '@/data/integrations';
import { EXTRA_CAPABILITIES, USE_CASES } from '@/data/use-cases';
import { DemoVideo } from './DemoVideo';
import { Icon } from './icons';
import { Card, Eyebrow, Section, SectionHeader, TextLink } from './primitives';

export function DemoSection() {
  return (
    <Section tone="white" id="demo" bordered>
      <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
        <SectionHeader
          eyebrow="The demo"
          title="One call. Watch the calendar change."
          lede="A caller asks for an appointment. On one side you hear the conversation; on the other you see each action land in the business’s systems, ending with the event in Google Calendar."
        />
        <TextLink href="/demo" className="mb-1 inline-flex items-center gap-1 text-sm">
          What the demo shows <ArrowRight className="size-3.5" />
        </TextLink>
      </div>
      <DemoVideo className="mt-10" />
    </Section>
  );
}

const STEPS = [
  {
    n: '01',
    title: 'The call comes in',
    body: 'On your phone line or over the web. Voco answers at once, in your business’s name.',
  },
  {
    n: '02',
    title: 'Voco understands and decides',
    body: 'It works out what the caller wants, asks for what is missing, and chooses the action. It only says what your systems confirm.',
  },
  {
    n: '03',
    title: 'The action runs in your system',
    body: 'The appointment is booked, the record created, the task assigned. The caller hears it is done; you see it where you already work.',
  },
];

const FLOW = [
  { label: 'Caller', sub: 'phone or web' },
  { label: 'Voco agent', sub: 'listens, decides, speaks', accent: true },
  { label: 'Connectors', sub: 'calendar, CRM, API' },
  { label: 'Your backend', sub: 'the system of record' },
];

export function HowItWorksSection() {
  return (
    <Section tone="paper" id="how-it-works" bordered>
      <SectionHeader
        eyebrow="How it works"
        title="From spoken request to finished work."
        lede="Most phone automation stops at taking a message. Voco finishes the job the caller rang about."
      />

      <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map((step) => (
          <li key={step.n} className="border-t border-mk-ink pt-5">
            <p className="font-code text-xs text-mk-signal-deep">{step.n}</p>
            <h3 className="mt-3 font-display text-xl font-medium tracking-[-0.01em]">{step.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      {/* voice → Voco → connectors → backend */}
      <div className="mt-14 rounded-2xl border border-mk-line bg-white p-5 sm:p-8" aria-label="How a call flows through Voco to your backend" role="group">
        <ol className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
          {FLOW.map((node, i) => (
            <li key={node.label} className="contents">
              <div
                className={`rounded-xl border px-4 py-4 ${
                  node.accent ? 'border-mk-signal bg-mk-signal/[0.07]' : 'border-mk-line bg-mk-paper'
                }`}
              >
                <p className="font-display text-base font-medium">{node.label}</p>
                <p className="mt-0.5 font-code text-[11px] text-mk-muted">{node.sub}</p>
              </div>
              {i < FLOW.length - 1 && (
                <span className="flex justify-center text-mk-faint" aria-hidden="true">
                  <ArrowRight className="size-4 rotate-90 md:rotate-0" />
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-5 font-code text-[11px] leading-relaxed text-mk-muted">
          The result travels back the same way: the backend confirms, and only then does the agent tell the caller it is done.
        </p>
      </div>
    </Section>
  );
}

export function UseCasesSection() {
  return (
    <Section tone="white" id="use-cases" bordered>
      <SectionHeader
        eyebrow="What it can do"
        title="Whatever callers ring you to get done."
        lede="Each of these is a conversation that ends with a change in one of your systems."
      />
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-mk-line bg-mk-line sm:grid-cols-2 lg:grid-cols-4">
        {USE_CASES.map((useCase) => (
          <Link
            key={useCase.slug}
            href={`/use-cases/${useCase.slug}`}
            className="group flex flex-col bg-white p-6 transition-colors hover:bg-mk-paper"
          >
            <Icon name={useCase.icon} className="size-5 text-mk-signal-deep" />
            <h3 className="mt-4 font-display text-lg font-medium tracking-[-0.01em]">
              {useCase.title}
              <ArrowUpRight className="ml-1 inline size-3.5 align-baseline text-mk-faint transition-colors group-hover:text-mk-ink" />
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-mk-muted">{useCase.short}</p>
          </Link>
        ))}
        {EXTRA_CAPABILITIES.map((capability) => (
          <div key={capability.title} className="flex flex-col bg-white p-6">
            <Icon name={capability.icon} className="size-5 text-mk-signal-deep" />
            <h3 className="mt-4 font-display text-lg font-medium tracking-[-0.01em]">{capability.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-mk-muted">{capability.short}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function BackendsSection() {
  const groups = integrationsByGroup();
  return (
    <Section tone="ink" id="backends">
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <SectionHeader
          onInk
          eyebrow="Backends"
          title="It works in the tools you already run."
          lede="Voco connects to your systems for you. Tell us what you use; we set the connection up and test it with you before the first real call."
        />
        <Link
          href="/integrations"
          className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-mk-signal underline decoration-mk-signal/40 underline-offset-4 hover:decoration-mk-signal"
        >
          All integrations <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.id} className="bg-mk-ink p-6">
            <h3 className="font-code text-[11px] uppercase tracking-[0.16em] text-white/50">{group.title}</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/integrations/${item.slug}`}
                    className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] transition-colors ${
                      item.slug === 'rest-api'
                        ? 'border-mk-signal/60 text-mk-signal hover:border-mk-signal'
                        : 'border-white/15 text-white/85 hover:border-white/50'
                    }`}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

const CONTROLS = [
  {
    icon: SlidersHorizontal,
    title: 'Your rules',
    body: 'Working hours, what can be booked and when, what the agent may and may not do. It follows them on every call.',
  },
  {
    icon: PhoneForwarded,
    title: 'Escalation and transfer',
    body: 'You decide which calls go to a person and who gets alerted. When the agent cannot help, it says so and hands over.',
  },
  {
    icon: FileText,
    title: 'Transcripts and recordings',
    body: 'Every call is recorded and transcribed, with the actions it took, so you can check exactly what was said and done.',
  },
  {
    icon: Languages,
    title: 'The caller’s language',
    body: 'The agent replies in the language the caller is speaking.',
  },
];

export function ControlSection() {
  return (
    <Section tone="paper" id="control" bordered>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <div>
          <SectionHeader
            eyebrow="Control and reliability"
            title="It does what you would, and shows its work."
            lede="An agent that acts in your systems has to be predictable. These are the guarantees it is built around."
          />
          <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-mk-line pt-6">
            <div>
              <dt className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">Typical reply time</dt>
              <dd className="mt-2 font-display text-3xl font-medium tracking-[-0.02em]">1–1.5 s</dd>
              <dd className="mt-1 text-xs leading-relaxed text-mk-muted">From the caller finishing to the agent speaking, measured on production calls.</dd>
            </div>
            <div>
              <dt className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">Double bookings</dt>
              <dd className="mt-2 font-display text-3xl font-medium tracking-[-0.02em]">None</dd>
              <dd className="mt-1 text-xs leading-relaxed text-mk-muted">A slot is reserved in one atomic step, so two callers cannot take the same time.</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CONTROLS.map(({ icon: ControlIcon, title, body }) => (
            <Card key={title} className="p-6">
              <ControlIcon className="size-5 text-mk-signal-deep" aria-hidden="true" />
              <h3 className="mt-4 font-display text-lg font-medium tracking-[-0.01em]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mk-muted">{body}</p>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function FaqSection() {
  return (
    <Section tone="white" id="faq" bordered>
      <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.025em] md:text-[2.75rem]">
            Asked before the first call.
          </h2>
          <div className="mt-8 border-t border-mk-line">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group border-b border-mk-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-display text-lg font-medium tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="relative size-4 shrink-0 text-mk-muted" aria-hidden="true">
                    <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
                    <span className="absolute left-1/2 top-0 h-4 w-px bg-current transition-transform group-open:scale-y-0" />
                  </span>
                </summary>
                <div className="pb-6 pr-10 text-[15px] leading-relaxed text-mk-muted">
                  <p>{item.a}</p>
                  {item.link && (
                    <p className="mt-3">
                      <TextLink href={item.link.href}>{item.link.label}</TextLink>
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
        <div className="lg:pt-16">
          <FAQChatWidget />
        </div>
      </div>
    </Section>
  );
}

export function FinalCtaSection({
  title = 'Hear it take a call in your systems.',
  lede = 'Bring the list of what your callers ask for and the tools you run. We will show you the agent doing that work, live.',
}) {
  return (
    <Section tone="ink" id="book-a-demo">
      <div className="max-w-3xl">
        <Eyebrow onInk>Book a demo</Eyebrow>
        <h2 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-[-0.03em] md:text-6xl">{title}</h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{lede}</p>
        <AuthAwareCTA onInk className="mt-9" />
      </div>
    </Section>
  );
}
