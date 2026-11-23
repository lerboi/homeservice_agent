import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { Card, PageHero, Section, SectionHeader, TextLink } from '@/components/marketing/primitives';
import { pageMetadata } from '@/data/site';

// Public pricing is "talk to us" (owner decision, 2026-11-23). The plan data
// in ./pricingData.js is NOT shown here but must stay: onboarding checkout,
// the dashboard upgrade screen and /api/usage read it, and its plan ids are
// wired to Stripe.
export const metadata = pageMetadata({
  title: 'Pricing | Voco',
  description:
    'Voco is priced to your call volume and the systems we connect. Tell us both and we will scope it with you.',
  path: '/pricing',
  ogTitle: 'Priced to your calls and your systems.',
  ogType: 'PRICING',
});

const FACTORS = [
  {
    title: 'Call volume',
    body: 'How many calls the agent takes in a month, and how long they tend to run.',
  },
  {
    title: 'Systems connected',
    body: 'Which of your tools the agent works in. A calendar is simpler than a CRM plus your own API.',
  },
  {
    title: 'What the agent does',
    body: 'Booking only, or booking plus intake, lookups, callbacks and escalation rules.',
  },
];

const INCLUDED = [
  'Setup and testing with our team',
  'The connections to your systems',
  'A dedicated phone number',
  'Transcripts and recordings of every call',
  'Changes to rules and wording as you learn what callers ask',
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Priced to your calls and your systems."
        lede="There is no table to pick from, because no two setups are the same. Tell us how many calls you take and what you want the agent to do; we will give you a number."
      >
        <AuthAwareCTA />
      </PageHero>

      <Section tone="white">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <div>
            <SectionHeader eyebrow="What sets the price" title="Three things." />
            <ol className="mt-10 space-y-8">
              {FACTORS.map((factor, i) => (
                <li key={factor.title} className="grid grid-cols-[auto_1fr] gap-5 border-t border-mk-line pt-6">
                  <span className="font-code text-xs text-mk-signal-deep">0{i + 1}</span>
                  <div>
                    <h3 className="font-display text-xl font-medium tracking-[-0.01em]">{factor.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-mk-muted">{factor.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <Card className="h-fit bg-mk-paper p-7">
            <h2 className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">Every setup includes</h2>
            <ul className="mt-5 space-y-3.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-snug">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mk-signal" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-7 border-t border-mk-line pt-5 text-sm leading-relaxed text-mk-muted">
              Already a customer? Your plan and usage are in your dashboard under Billing.{' '}
              <TextLink href="/auth/signin">Sign in</TextLink>
            </p>
          </Card>
        </div>
      </Section>
    </>
  );
}
