import { DemoCTA } from '@/components/landing/DemoCTA';
import { LiveCallDemo } from '@/components/marketing/LiveCallDemo';
import {
  ControlSection, FinalCtaSection, HowItWorksSection, UseCasesSection,
} from '@/components/marketing/LandingSections';
import { Container, Em, Eyebrow } from '@/components/marketing/primitives';
import { TAGLINE, pageMetadata } from '@/data/site';

export const metadata = pageMetadata({
  title: 'Voco Voice: a voice agent that works in your systems | Voco',
  description:
    'Voco Voice answers the call, understands what the caller wants, and does the work in the systems you already run: books the appointment, schedules the task, creates the record.',
  path: '/voice',
  ogTitle: TAGLINE,
  ogType: 'VOCO VOICE',
});

export default function VoicePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-mk-ink/10 bg-mk-signal-wash pb-16 pt-32 text-mk-ink md:pb-24 md:pt-40">
        <div className="mk-grid-paper pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_right,transparent,black)]" aria-hidden="true" />
        <Container size="wide" className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
            <div>
              <Eyebrow className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-mk-signal-deep" />
                Voco Voice
              </Eyebrow>
              <h1 className="mt-6 font-display text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-[5rem]">
                Give your backend <Em tone="signal-deep">a voice.</Em>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-mk-ink/70">
                Voco Voice answers the call, understands what the caller wants, and does the work in
                your systems: books the appointment, schedules the task, creates the record.
              </p>
              <DemoCTA className="mt-9" />
            </div>
            <LiveCallDemo />
          </div>
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
