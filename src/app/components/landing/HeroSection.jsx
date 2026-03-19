import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';

export function HeroSection() {
  return (
    <section className="bg-landing-dark pt-24 md:pt-32 pb-16 md:pb-24 px-6">
      <AnimatedSection className="max-w-6xl mx-auto md:grid md:grid-cols-2 md:gap-12 md:items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold text-white leading-tight">
            Every Call You Miss Is a Job Your Competitor Just Won
          </h1>
          <p className="text-lg text-white/80 mt-4 mb-8">
            HomeService AI answers every call, triages the emergency, and books the slot — while you&apos;re on the job.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              size="lg"
              className="bg-landing-accent text-white hover:bg-landing-accent/90 min-h-[44px]"
            >
              <Link href="/onboarding">Start My 5-Minute Setup</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white/10 min-h-[44px]"
            >
              <Link href="/demo">Watch Demo</Link>
            </Button>
          </div>
        </div>
        <div className="mt-12 md:mt-0">
          <Image
            src="/images/dashboard-mockup.png"
            alt="HomeService AI dashboard showing live call triage and booking"
            width={640}
            height={400}
            priority
            className="rounded-xl shadow-2xl"
          />
        </div>
      </AnimatedSection>
    </section>
  );
}
