import { ArrowRight, Check } from 'lucide-react';
import { DemoCTA } from '@/components/landing/DemoCTA';
import { AgentChatDemo } from '@/components/marketing/AgentChatDemo';
import { FinalCtaSection } from '@/components/marketing/LandingSections';
import { Icon } from '@/components/marketing/icons';
import { Container, Em, Eyebrow, Section } from '@/components/marketing/primitives';
import {
  AGENT_CHANNELS, AGENT_CONTROLS, AGENT_JOBS, AGENT_RELIEFS, AGENT_STEPS, AGENT_WEEK,
} from '@/data/agent';
import { pageMetadata } from '@/data/site';

export const metadata = pageMetadata({
  title: 'Voco Agent: an AI agent that works inside your business | Voco',
  description:
    'Voco Agent is connected to your reviews, inbox, calendar, search data and support desk. Message it on WhatsApp, Telegram, Slack or email: it finds the answer, then does the job.',
  path: '/agent',
  ogTitle: 'Ask your business anything. Then tell it what to do.',
  ogType: 'VOCO AGENT',
});

// What the agent reaches, shown either side of the chat in the hero.
const REACH_LEFT = ['Reviews', 'Inbox', 'Calendar'];
const REACH_RIGHT = ['Google Search', 'Support desk', 'Your records'];

function ReachColumn({ items, side }) {
  return (
    <ul className={`hidden flex-col justify-center gap-5 lg:flex ${side === 'left' ? 'items-end' : 'items-start'}`} aria-hidden="true">
      {items.map((item, i) => (
        <li key={item} className={`flex items-center ${side === 'left' ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className="rounded-full border border-mk-ink/15 bg-white px-4 py-2 font-code text-[11px] uppercase tracking-[0.12em] text-mk-ink">
            {item}
          </span>
          <span className={`h-px bg-mk-ink/25 ${i === 1 ? 'w-10' : 'w-20'}`} />
          <span className="size-1.5 rounded-full bg-mk-spark-deep" />
        </li>
      ))}
    </ul>
  );
}

export default function AgentPage() {
  return (
    <>
      {/* Hero: the chat in the middle, what it reaches either side */}
      <section className="relative overflow-hidden border-b border-mk-ink/10 bg-mk-spark-wash pb-20 pt-28 text-mk-ink md:pb-24 md:pt-32">
        <div className="mk-grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden="true" />
        <Container size="wide" className="relative">
          <div className="mx-auto max-w-5xl text-center">
            <Eyebrow tone="spark" className="flex items-center justify-center gap-2">
              <span className="size-1.5 rounded-full bg-mk-spark-deep" />
              Voco Agent
            </Eyebrow>
            <h1 className="mt-6 font-display text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-[4.75rem]">
              Ask your business anything. <br className="hidden md:block" />
              <Em>Then tell it what to do.</Em>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-mk-ink/70">
              Voco Agent is an AI agent connected to your reviews, inbox, calendar, search data and
              support desk. Message it the way you would message a colleague. It finds the answer,
              then does the job.
            </p>
            <DemoCTA variant="ink" withWatch={false} className="mt-9 justify-center" />
          </div>

          <div className="mt-12 grid items-stretch gap-0 lg:grid-cols-[1fr_minmax(0,34rem)_1fr]">
            <ReachColumn items={REACH_LEFT} side="left" />
            <AgentChatDemo className="mx-auto w-full max-w-xl border-mk-ink/15" />
            <ReachColumn items={REACH_RIGHT} side="right" />
          </div>
          <p className="mt-6 text-center font-code text-[11px] uppercase tracking-[0.14em] text-mk-ink/50">
            An illustration. Pick a channel to see another job.
          </p>
        </Container>
      </section>

      {/* The problem, in the owner's words */}
      <Section tone="white" id="why">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.7fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow tone="spark">Sound familiar?</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-5xl">
              The jobs nobody <Em>has time for.</Em>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-mk-muted">
              They are not hard. There are just too many of them, spread over too many screens.
            </p>
          </div>
          <ul>
            {AGENT_RELIEFS.map((item) => (
              <li key={item.pain} className="grid gap-3 border-t border-mk-ink py-7 last:border-b sm:grid-cols-2 sm:gap-10">
                <p className="font-display text-xl font-medium leading-snug tracking-[-0.015em] text-mk-ink/45 line-through decoration-mk-ink/25 decoration-1">
                  {item.pain}
                </p>
                <p className="flex gap-3 text-[15px] leading-relaxed">
                  <ArrowRight className="mt-1 size-4 shrink-0 text-mk-spark-deep" aria-hidden="true" />
                  {item.relief}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Jobs it does */}
      <Section tone="paper" id="jobs" bordered size="wide">
        <div className="max-w-3xl">
          <Eyebrow tone="spark">What it does</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-6xl">
            It tells you. <Em>And it does it.</Em>
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-mk-muted">
            Six jobs to start with. Under each is the kind of thing you would type.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {AGENT_JOBS.map((job) => (
            <li
              key={job.id}
              className={`flex flex-col rounded-2xl border border-mk-line bg-white p-6 sm:p-7 ${job.size === 'wide' ? 'lg:col-span-2' : ''}`}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-mk-spark-wash text-mk-spark-deep">
                <Icon name={job.icon} className="size-5" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">{job.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{job.body}</p>
              <p className="mt-auto pt-6">
                <span className="inline-block rounded-2xl rounded-bl-md bg-mk-ink px-3.5 py-2 text-[13.5px] leading-snug text-white">
                  {job.say}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* An example week */}
      <Section tone="ink" id="week">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow onInk tone="spark">While you were busy</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-5xl">
              A week of it, <Em tone="spark">written down.</Em>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              Every answer and every action lands in a log you can read. This is an example of what a
              week looks like.
            </p>
          </div>
          <ol className="relative border-l border-white/15 pl-6 sm:pl-8">
            {AGENT_WEEK.map((entry) => (
              <li key={`${entry.day}-${entry.time}`} className="relative grid grid-cols-[5.5rem_1fr] gap-4 pb-7 last:pb-0">
                <span className={`absolute -left-[1.72rem] top-1.5 size-2 rounded-full sm:-left-[2.22rem] ${entry.kind === 'act' ? 'bg-mk-spark' : 'bg-white/40'}`} aria-hidden="true" />
                <p className="font-code text-[11px] uppercase tracking-[0.12em] text-white/50">
                  {entry.day} <span className="text-white/30">{entry.time}</span>
                </p>
                <p className="text-[15px] leading-snug text-white/90">
                  {entry.text}
                  <span className={`ml-2 font-code text-[10px] uppercase tracking-[0.12em] ${entry.kind === 'act' ? 'text-mk-spark' : 'text-white/40'}`}>
                    {entry.kind === 'act' ? 'did' : 'told you'}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Where you talk to it */}
      <Section tone="white" id="channels">
        <div className="max-w-2xl">
          <Eyebrow tone="spark">Where you talk to it</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-5xl">
            No new app. <Em>It is in the ones you have.</Em>
          </h2>
        </div>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-mk-line bg-mk-line sm:grid-cols-2 lg:grid-cols-4">
          {AGENT_CHANNELS.map((channel) => (
            <li key={channel.id} className="bg-white p-7">
              <h3 className="font-display text-3xl font-semibold tracking-[-0.03em]">{channel.name}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-mk-muted">{channel.line}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Control, then setup */}
      <Section tone="paper" id="control" bordered>
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <Eyebrow tone="spark">You stay in charge</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-5xl">
              It acts on <Em>your say-so.</Em>
            </h2>
            <ul className="mt-9 space-y-7">
              {AGENT_CONTROLS.map((control) => (
                <li key={control.title} className="flex gap-4">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-mk-spark text-mk-ink">
                    <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{control.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-mk-muted">{control.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-mk-spark/60 bg-mk-spark-wash p-7 sm:p-10">
            <p className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-spark-deep">Getting it</p>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.03em]">
              We set it up with you.
            </h2>
            <ol className="mt-8">
              {AGENT_STEPS.map((step) => (
                <li key={step.n} className="grid grid-cols-[auto_1fr] gap-x-5 border-t border-mk-ink/15 py-5">
                  <p className="font-code text-xs text-mk-spark-deep">{step.n}</p>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.01em]">{step.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-mk-ink/70">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <FinalCtaSection
        variant="spark"
        title="Tell us the job you would hand over first."
        lede="Bring the tools you run and the tasks that eat your week. We will show you the agent doing them, live."
      />
    </>
  );
}
