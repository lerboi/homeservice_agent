import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';

export function HowItWorksSection() {
  const steps = [
    { number: 1, text: 'A homeowner calls at 11 PM about a burst pipe.', delay: 0 },
    { number: 2, text: 'Your AI answers in one second, triages it as an emergency.', delay: 0.08 },
    {
      number: 3,
      text: 'The job is booked for first thing tomorrow. You get a text. You sleep.',
      delay: 0.16,
    },
  ];

  return (
    <section id="how-it-works" className="bg-landing-surface py-16 md:py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-semibold text-center mb-12 text-landing-dark">
          Here&apos;s How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step) => (
            <AnimatedSection key={step.number} delay={step.delay}>
              <div className="flex flex-col items-start">
                <div className="w-10 h-10 rounded-full bg-landing-accent text-white flex items-center justify-center font-semibold mb-4">
                  {step.number}
                </div>
                <p className="text-base text-landing-dark">{step.text}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <div className="flex justify-center">
          <Button
            asChild
            size="lg"
            className="bg-landing-accent text-white hover:bg-landing-accent/90 min-h-[44px] mt-12"
          >
            <Link href="/onboarding">Start My 5-Minute Setup</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
