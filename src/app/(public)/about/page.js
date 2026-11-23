import { FinalCtaSection } from '@/components/marketing/LandingSections';
import { PageHero, Section, SectionHeader } from '@/components/marketing/primitives';
import { pageMetadata } from '@/data/site';

export const metadata = pageMetadata({
  title: 'About | Voco',
  description:
    'Voco builds voice agents that do the work a caller rang about, inside the systems a business already runs.',
  path: '/about',
  ogTitle: 'The call should end with the work done.',
  ogType: 'ABOUT',
});

const PRINCIPLES = [
  {
    title: 'Finish the job',
    body: 'A message taken is work postponed. The measure of a call is whether the thing the caller wanted now exists in your system.',
  },
  {
    title: 'Say only what is true',
    body: 'The agent offers a time because the calendar says it is free, and says “booked” because the booking succeeded. If it cannot do something, it says so.',
  },
  {
    title: 'Work where you already work',
    body: 'You should not have to adopt a new tool to answer the phone. The result goes into the calendar, CRM or database your team already opens every morning.',
  },
  {
    title: 'We do the wiring',
    body: 'Connecting a voice agent to a business’s systems is the hard part, so we do it with you and test it before a real caller ever reaches it.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="The call should end with the work done."
        lede="People still pick up the phone when something matters. Too often the call ends with a promise that someone will get back to them. Voco exists to close that gap."
      />

      <Section tone="white">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <SectionHeader eyebrow="What we build" title="A voice for your backend." />
          <div className="space-y-5 text-lg leading-relaxed text-mk-muted">
            <p>
              Voco is a voice agent connected to the systems a business runs on. It answers the call,
              understands the request, and carries it out: it books the appointment, creates the record,
              schedules the task.
            </p>
            <p>
              We started by answering phones for small service businesses, where a missed call is a
              missed job. Building that taught us the part that matters is not the voice. It is what
              happens after the caller says what they want. That is the product now, for any business
              whose callers need something done.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="paper" bordered>
        <SectionHeader eyebrow="How we work" title="Four things we hold to." />
        <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {PRINCIPLES.map((principle, i) => (
            <div key={principle.title} className="border-t border-mk-ink pt-5">
              <p className="font-code text-xs text-mk-signal-deep">0{i + 1}</p>
              <h3 className="mt-3 font-display text-xl font-medium tracking-[-0.01em]">{principle.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{principle.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="white" bordered>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <SectionHeader eyebrow="The company" title="Voco Private Limited." />
          <p className="text-lg leading-relaxed text-mk-muted">
            Voco is incorporated in Singapore and works with businesses wherever their callers are.
            If you want to know whether it fits what your callers ask for, the quickest way to find
            out is to show us.
          </p>
        </div>
      </Section>

      <FinalCtaSection />
    </>
  );
}
