import { Suspense } from 'react';
import { Card, Container, Eyebrow, Lede, PageTitle } from '@/components/marketing/primitives';
import { pageMetadata } from '@/data/site';
import { ContactForm } from './ContactForm';

export const metadata = pageMetadata({
  title: 'Book a demo | Voco',
  description:
    'Tell us what your callers ask for and the systems you run. We will show you a voice agent doing that work, live.',
  path: '/contact',
  ogTitle: 'Book a demo',
  ogType: 'CONTACT',
});

const NEXT_STEPS = [
  'We reply within one business day.',
  'A short call to hear what your callers ask for and which systems you use.',
  'A live demo of the agent doing that work.',
];

export default function ContactPage() {
  return (
    <section className="bg-mk-paper pb-20 pt-32 text-mk-ink md:pb-28 md:pt-40">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <Eyebrow>Contact</Eyebrow>
            <PageTitle className="mt-5">Book a demo.</PageTitle>
            <Lede className="mt-6 max-w-lg">
              Tell us what your callers ring about and what you run. We will show you the agent doing
              that work. Support and partnership questions come through the same form.
            </Lede>
            <ol className="mt-10 space-y-4 border-t border-mk-line pt-6">
              {NEXT_STEPS.map((step, i) => (
                <li key={step} className="grid grid-cols-[auto_1fr] gap-4 text-[15px] leading-relaxed text-mk-muted">
                  <span className="font-code text-xs leading-6 text-mk-signal-deep">0{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <Card className="p-6 sm:p-8">
            <Suspense fallback={null}>
              <ContactForm />
            </Suspense>
          </Card>
        </div>
      </Container>
    </section>
  );
}
