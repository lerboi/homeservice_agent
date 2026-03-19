import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';

export function FinalCTASection() {
  return (
    <section id="cta" className="bg-landing-accent px-6">
      <AnimatedSection className="max-w-3xl mx-auto text-center py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          Your Next Emergency Call Is Tonight
        </h2>
        <p className="text-lg text-white/90 mb-8">Set up your AI in 5 minutes. No tech skills needed.</p>
        <Button
          asChild
          size="lg"
          className="bg-landing-dark text-white hover:bg-landing-dark/90 min-h-[44px] text-base px-8"
        >
          <Link href="/onboarding">Start My 5-Minute Setup</Link>
        </Button>
      </AnimatedSection>
    </section>
  );
}
