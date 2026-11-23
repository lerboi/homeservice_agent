import { DemoCTA } from '@/components/landing/DemoCTA';
import { LiveCallDemo } from '@/components/marketing/LiveCallDemo';
import {
  ControlSection, FinalCtaSection, HowItWorksSection, UseCasesSection,
} from '@/components/marketing/LandingSections';
import { ReachColumn } from '@/components/marketing/ReachColumn';
import { Container, Em, Eyebrow } from '@/components/marketing/primitives';
import { TAGLINE, pageMetadata } from '@/data/site';

export const metadata = pageMetadata({
  title: 'Voco Voice: an AI voice agent that answers your calls and does the work | Voco',
  description:
    'Voco Voice answers your calls, understands what the caller wants, and does the work in the systems you already run: books the appointment, schedules the task, creates the record.',
  path: '/voice',
  ogTitle: TAGLINE,
  ogType: 'VOCO VOICE',
});

// How callers reach it, and where the work ends up: either side of the call.
const REACH_LEFT = ['Your phone line', 'Your website', 'After hours'];
const REACH_RIGHT = ['Your calendar', 'Texts and email', 'Your own systems'];

export default function VoicePage() {
  return (
    <>
      {/* Hero: the call in the middle, callers on one side, your systems on the other */}
      <section className="relative overflow-hidden border-b border-mk-ink/10 bg-mk-signal-wash pb-20 pt-28 text-mk-ink md:pb-24 md:pt-32">
        <div className="mk-grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden="true" />
        <Container className="relative">
          <div className="mx-auto max-w-5xl text-center">
            <Eyebrow className="flex items-center justify-center gap-2">
              <span className="size-1.5 rounded-full bg-mk-signal-deep" />
              Voco Voice
            </Eyebrow>
            <h1 className="mt-6 font-display text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-[4.75rem]">
              It answers every call. <br className="hidden md:block" />
              <Em tone="signal-deep">Then it does the job.</Em>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-mk-ink/70">
              Voco Voice is an AI voice agent connected to your calendar and the other systems you
              run. It talks with your callers the way a person would, then books the appointment,
              schedules the task or creates the record while they are still on the line.
            </p>
            <DemoCTA variant="ink" withWatch={false} className="mt-9 justify-center" />
          </div>

          <div className="mt-12 grid items-stretch gap-0 lg:grid-cols-[1fr_minmax(0,42rem)_1fr]">
            <ReachColumn items={REACH_LEFT} side="left" label="Callers reach it on" />
            <div className="mx-auto flex w-full max-w-2xl flex-col">
              <LiveCallDemo />
            </div>
            <ReachColumn items={REACH_RIGHT} side="right" label="The work lands in" />
          </div>
          <p className="mt-6 text-center font-code text-[11px] uppercase tracking-[0.14em] text-mk-ink/50">
            An illustration of a booking call, start to finish.
          </p>
        </Container>
      </section>

      <HowItWorksSection />
      <UseCasesSection />
      <ControlSection />
      <FinalCtaSection
        title="Hear it take a call in your systems."
        lede="Bring the list of what your callers ask for and the tools you run. We will show you the agent doing that work, live."
      />
    </>
  );
}
