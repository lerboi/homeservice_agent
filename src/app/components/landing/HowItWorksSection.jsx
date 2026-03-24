import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { ArrowRight } from 'lucide-react';
import dynamic from 'next/dynamic';

const HowItWorksSticky = dynamic(
  () => import('./HowItWorksSticky').then((m) => m.HowItWorksSticky),
  {
    loading: () => (
      <div className="space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[180px] rounded-2xl bg-[#F5F5F4]/50 border border-black/[0.04]" />
        ))}
      </div>
    ),
  }
);

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative bg-white py-20 md:py-28 px-6">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-medium text-[#C2410C] tracking-wide uppercase mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] tracking-tight">
            From missed call to booked job.
            <br className="hidden sm:block" />
            <span className="text-[#475569]">In under two minutes.</span>
          </h2>
        </AnimatedSection>

        <HowItWorksSticky />

        <AnimatedSection delay={0.3} className="flex justify-center -mt-[19vh]">
          <Button
            asChild
            size="lg"
            className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 min-h-[48px] px-6 text-[15px] font-medium rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_4px_16px_0_rgba(194,65,12,0.4)] hover:-translate-y-0.5 group"
          >
            <Link href="/onboarding">
              Start My 5-Minute Setup
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </AnimatedSection>
      </div>
    </section>
  );
}
