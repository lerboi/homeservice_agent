import { DemoCTA } from '@/components/landing/DemoCTA';
import { DemoVideo } from '@/components/marketing/DemoVideo';
import { FinalCtaSection } from '@/components/marketing/LandingSections';
import { Container, Eyebrow, Lede, PageTitle, Section, SectionHeader } from '@/components/marketing/primitives';
import { pageMetadata } from '@/data/site';

export const metadata = pageMetadata({
  title: 'Watch the demo | Voco',
  description:
    'One call, start to finish: a caller asks for an appointment and it lands in Google Calendar while they are still on the line.',
  path: '/demo',
  ogTitle: 'One call. Watch the calendar change.',
  ogType: 'DEMO',
});

const MOMENTS = [
  {
    t: '01',
    title: 'The caller asks',
    body: 'A person rings and says what they want in their own words. No menu, no keypad.',
  },
  {
    t: '02',
    title: 'The agent checks',
    body: 'It reads real availability from the calendar and offers times that are actually free.',
  },
  {
    t: '03',
    title: 'It confirms before acting',
    body: 'Name and time are read back. Nothing is booked until the caller says yes.',
  },
  {
    t: '04',
    title: 'The event appears',
    body: 'The appointment is created and the event shows up in Google Calendar, with a link to open it.',
  },
];

export default function DemoPage() {
  return (
    <>
      <section className="bg-mk-paper pb-16 pt-32 text-mk-ink md:pb-20 md:pt-40">
        <Container>
          <Eyebrow>The demo</Eyebrow>
          <PageTitle className="mt-5 max-w-4xl">One call. Watch the calendar change.</PageTitle>
          <Lede className="mt-6 max-w-2xl">
            The conversation is on the left. On the right, each thing the agent does in the business’s
            systems appears as it happens, ending with the event in Google Calendar.
          </Lede>
          <DemoVideo className="mt-12" />
        </Container>
      </section>

      <Section tone="white" bordered>
        <SectionHeader
          eyebrow="What you are watching"
          title="Four moments in one call."
          lede="The same four things happen whatever the task is: a request, a check against your data, a confirmation, and a change in your system."
        />
        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {MOMENTS.map((moment) => (
            <li key={moment.t} className="border-t border-mk-ink pt-5">
              <p className="font-code text-xs text-mk-signal-deep">{moment.t}</p>
              <h3 className="mt-3 font-display text-xl font-medium tracking-[-0.01em]">{moment.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{moment.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-14 rounded-2xl border border-mk-line bg-mk-paper p-6 sm:p-8">
          <h3 className="font-display text-xl font-medium tracking-[-0.01em]">Rather see it with your own systems?</h3>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-mk-muted">
            The recording uses a calendar. In a live demo we point the agent at the task your callers
            actually ring about and the tools you run.
          </p>
          <DemoCTA withWatch={false} className="mt-6" />
        </div>
      </Section>

      <FinalCtaSection />
    </>
  );
}
