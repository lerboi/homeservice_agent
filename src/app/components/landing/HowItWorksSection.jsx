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
          <div key={i} className="h-[180px] rounded-2xl bg-white border border-stone-200/60 shadow-sm" />
        ))}
      </div>
    ),
  }
);

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative bg-[#F5F5F4] py-20 md:py-28 px-6">
      <div className="relative max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-semibold text-[#F97316] tracking-[0.15em] uppercase mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] tracking-tight">
            From missed call to booked job.
            <br className="hidden sm:block" />
            <span className="text-[#475569]">In under two minutes.</span>
          </h2>
        </AnimatedSection>

        {/* Sticky scroll cards — all breakpoints */}
        <HowItWorksSticky />

        <AnimatedSection delay={0.3} className="flex justify-center mt-16">
          <Button
            asChild
            size="lg"
            className="bg-[#F97316] text-white hover:bg-[#F97316]/90 min-h-[48px] px-6 text-[15px] font-medium rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_4px_16px_0_rgba(249,115,22,0.4)] hover:-translate-y-0.5 group"
          >
            <Link href="/onboarding">
              See It In Action
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </AnimatedSection>
      </div>
    </section>
  );
}
