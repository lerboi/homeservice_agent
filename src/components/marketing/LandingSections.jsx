/**
 * Sections shared by the home page and the product pages. Server components.
 *
 * Home: Products, Demo, Backends, Setup, FAQ, Final CTA.
 * /voice: How it works, What it can do, Control and reliability, Final CTA.
 * Copy rule: claim only what the product does; numbers must be ones measured
 * on the system.
 */
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Braces, CalendarDays, Check, FileText, Languages, Mail, PhoneForwarded, Slack,
  SlidersHorizontal,
} from 'lucide-react';
import { siGooglecalendar, siWhatsapp } from 'simple-icons';
import { DemoCTA } from '@/components/landing/DemoCTA';
import { FAQChatWidget } from '@/app/components/landing/FAQChatWidget';
import { FAQ_ITEMS } from '@/data/faq';
import { getIntegration } from '@/data/integrations';
import { EXTRA_CAPABILITIES, USE_CASES } from '@/data/use-cases';
import { DemoVideo } from './DemoVideo';
import { Icon } from './icons';
import { ButtonLink, Card, Em, Eyebrow, Section, SectionHeader, TextLink } from './primitives';

export function DemoSection() {
  return (
    <Section tone="white" id="demo" bordered>
      <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
        <SectionHeader
          eyebrow="Voco Voice · the demo"
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

const PRODUCT_PANELS = [
  {
    key: 'voice',
    name: 'Voco Voice',
    href: '/voice',
    title: <>For the people who <Em tone="signal-deep">call you.</Em></>,
    body: 'A voice agent on your phone line or website. It answers at once, works out what the caller wants, and finishes the job in your systems while they are still on the line.',
    jobs: ['Books and moves appointments', 'Takes enquiries into your CRM', 'Schedules callbacks and tasks', 'Looks up orders and accounts'],
    where: 'Phone · Web',
    wash: 'bg-mk-signal-wash',
    border: 'border-mk-signal/40',
    deep: 'text-mk-signal-deep',
    fill: 'bg-mk-signal',
    button: 'primary',
  },
  {
    key: 'agent',
    name: 'Voco Agent',
    href: '/agent',
    title: <>For the work <Em tone="spark-deep">behind the counter.</Em></>,
    body: 'An AI agent connected to your reviews, inbox, calendar, search data and support desk. Message it like a colleague. It finds the answer, then does the job.',
    jobs: ['Reads and replies to customer feedback', 'Explains how you show up on Google', 'Sorts email and drafts replies', 'Runs the calendar and tells people'],
    where: 'WhatsApp · Telegram · Slack · Email',
    wash: 'bg-mk-spark-wash',
    border: 'border-mk-spark/60',
    deep: 'text-mk-spark-deep',
    fill: 'bg-mk-spark',
    button: 'spark',
  },
];

export function ProductsSection() {
  return (
    <Section tone="paper" id="products" size="wide">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <h2 className="max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-6xl">
          Two products. One idea: the work gets done.
        </h2>
        <p className="max-w-xs text-[15px] leading-relaxed text-mk-muted md:pb-2">
          Take either, or both. Each is set up by us, with you, in the tools you already use.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {PRODUCT_PANELS.map((panel) => (
          <article key={panel.key} className={`flex flex-col rounded-3xl border p-7 sm:p-10 ${panel.wash} ${panel.border}`}>
            <p className={`flex items-center gap-2 font-code text-[11px] uppercase tracking-[0.16em] ${panel.deep}`}>
              <span className={`size-2 rounded-full ${panel.fill}`} />
              {panel.name}
            </p>
            <h3 className="mt-5 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[2.5rem]">
              {panel.title}
            </h3>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mk-ink/75">{panel.body}</p>

            <ul className="mt-8 grid gap-x-6 gap-y-3 border-t border-mk-ink/10 pt-6 sm:grid-cols-2">
              {panel.jobs.map((job) => (
                <li key={job} className="flex items-start gap-2.5 text-[15px] leading-snug">
                  <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-mk-ink ${panel.fill}`}>
                    <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
                  </span>
                  {job}
                </li>
              ))}
            </ul>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-10">
              <p className="font-code text-[11px] uppercase tracking-[0.14em] text-mk-ink/60">{panel.where}</p>
              <ButtonLink href={panel.href} variant={panel.button}>
                See {panel.name} <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

const SETUP_STEPS = [
  {
    n: '01',
    title: 'Show us how you work',
    body: 'What callers ask for, what eats your week, and which tools you run. A demo call is enough to start.',
  },
  {
    n: '02',
    title: 'We connect and test it',
    body: 'Voco links to your systems, sets the rules with you, and tries it on real requests before anything goes live.',
  },
  {
    n: '03',
    title: 'It goes to work',
    body: 'Calls get answered and jobs get done. You see every one of them in the tools you already use.',
  },
];

export function SetupSection() {
  return (
    <Section tone="paper" id="setup" bordered>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div>
          <Eyebrow>Getting started</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-5xl">
            You do not set <Em tone="signal-deep">anything</Em> up.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-mk-muted">
            No software to learn and nothing to install. We do the connecting; you tell us what good looks like.
          </p>
        </div>
        <ol>
          {SETUP_STEPS.map((step) => (
            <li key={step.n} className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-mk-ink py-7 last:border-b sm:gap-x-10">
              <p className="font-display text-5xl font-semibold leading-none tracking-[-0.04em] text-mk-ink/15 sm:text-6xl">{step.n}</p>
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-mk-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
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
    <Section tone="white" id="how-it-works">
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
    <Section tone="paper" id="use-cases" bordered>
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

/**
 * The tools shown on the home page (owner's list, 2026-11-24): messaging,
 * email, the two calendars and the business's own API. `slug` must exist in
 * src/data/integrations.js. `brand` is a simple-icons mark drawn in its own
 * colour; the rest use a lucide icon.
 */
export const HOME_TOOLS = [
  { slug: 'whatsapp', name: 'WhatsApp', does: 'Confirmations to your callers, and a chat with your agent.', brand: siWhatsapp },
  { slug: 'email', name: 'Email', does: 'Sorts the inbox, drafts replies, sends confirmations.', icon: Mail },
  { slug: 'slack', name: 'Slack', does: 'Alerts for your team, and the agent in your channel.', icon: Slack },
  { slug: 'google-calendar', name: 'Google Calendar', does: 'Checks real availability and writes the booking.', brand: siGooglecalendar },
  { slug: 'outlook-calendar', name: 'Outlook Calendar', does: 'The same, for teams on Microsoft 365.', icon: CalendarDays },
  { slug: 'rest-api', name: 'Your own API', does: 'Anything else your systems can do, through your API.', icon: Braces, accent: true },
];

function ToolIcon({ tool }) {
  if (tool.brand) {
    return (
      <svg viewBox="0 0 24 24" className="size-7" fill={`#${tool.brand.hex}`} aria-hidden="true">
        <path d={tool.brand.path} />
      </svg>
    );
  }
  const Glyph = tool.icon;
  return <Glyph className="size-7 text-mk-ink" strokeWidth={1.75} aria-hidden="true" />;
}

export function BackendsSection() {
  const tools = HOME_TOOLS.filter((tool) => getIntegration(tool.slug));
  return (
    <Section tone="ink" id="backends" className="relative overflow-hidden">
      <div className="mk-grid-ink pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden="true" />
      <div className="relative">
        <SectionHeader
          onInk
          align="center"
          eyebrow="Your tools"
          title="It works in the tools you already run."
          lede="Voco connects them for you and tests each one with you before anything goes live."
        />

        {/* Voco in the middle, a line out to each tool */}
        <div className="relative mx-auto mt-12 hidden h-24 max-w-5xl lg:block" aria-hidden="true">
          <span className="absolute left-1/2 top-0 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 font-display text-base font-semibold tracking-[-0.01em]">
            <span className="size-2 rounded-full bg-mk-signal" />
            Voco
            <span className="size-2 rounded-full bg-mk-spark" />
          </span>
          <span className="absolute left-1/2 top-11 h-6 w-px bg-white/20" />
          <span className="absolute left-[16.66%] right-[16.66%] top-[4.25rem] h-px bg-white/20" />
          {['left-[16.66%]', 'left-1/2', 'left-[83.33%]'].map((x) => (
            <span key={x} className={`absolute top-[4.25rem] h-7 w-px bg-white/20 ${x}`} />
          ))}
        </div>

        <ul className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:mt-0 lg:grid-cols-3">
          {tools.map((tool) => (
            <li key={tool.slug}>
              <div
                className={`flex h-full items-start gap-4 rounded-2xl border p-5 ${
                  tool.accent ? 'border-mk-signal/50 bg-mk-signal/[0.08]' : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white">
                  <ToolIcon tool={tool} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold tracking-[-0.01em]">{tool.name}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-white/65">{tool.does}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-sm text-white/60">
          Use something else?{' '}
          <Link href="/contact?type=sales" className="font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
            Tell us what you run
          </Link>
        </p>
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
    <Section tone="white" id="control" bordered>
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
            Asked before getting started.
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
  title = 'See it done in your own systems.',
  lede = 'Bring what your callers ask for, the jobs that eat your week, and the tools you run. We will show you the work being done, live.',
  variant = 'primary',
}) {
  return (
    <Section tone="ink" id="book-a-demo">
      <div className="max-w-3xl">
        <Eyebrow onInk tone={variant === 'spark' ? 'spark' : 'signal'}>Book a demo</Eyebrow>
        <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-6xl">{title}</h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{lede}</p>
        <DemoCTA onInk variant={variant} className="mt-9" />
      </div>
    </Section>
  );
}
