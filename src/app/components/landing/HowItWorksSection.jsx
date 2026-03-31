import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { ArrowRight } from 'lucide-react';
import dynamic from 'next/dynamic';

const HowItWorksMinimal = dynamic(
  () => import('./HowItWorksMinimal').then((m) => m.HowItWorksMinimal),
  {
    loading: () => (
      <div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-h-screen bg-white" />
        ))}
      </div>
    ),
  }
);

export function HowItWorksSection() {
  return (
    <section id="how-it-works">
      <div className="bg-white pt-24 pb-0">
        <AnimatedSection className="max-w-xl mx-auto text-center px-6">
          <p className="text-xs md:text-sm font-semibold text-[#F97316] tracking-[0.15em] uppercase mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0F172A] tracking-tight leading-[1.2]">
            From first ring to full calendar — in one call.
          </h2>
        </AnimatedSection>
      </div>

      <HowItWorksMinimal />

      <div className="bg-white py-16 flex justify-center px-6">
        <AnimatedSection delay={0.3}>
          <Button
            asChild
            size="lg"
            className="bg-[#F97316] text-white hover:bg-[#F97316]/90 min-h-[48px] px-6 text-[15px] font-medium rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_4px_16px_0_rgba(249,115,22,0.4)] hover:-translate-y-0.5 group"
          >
            <Link href="/pricing">
              See It In Action
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </AnimatedSection>
      </div>
    </section>
  );
}
