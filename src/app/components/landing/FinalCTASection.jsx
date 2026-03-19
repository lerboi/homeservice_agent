import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { ArrowRight } from 'lucide-react';

export function FinalCTASection() {
  return (
    <section id="cta" className="relative overflow-hidden">
      {/* Layered gradient background */}
      <div className="absolute inset-0 bg-[#C2410C]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,0,0,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08),transparent_50%)]" />

      <div className="relative max-w-3xl mx-auto text-center px-6 py-20 md:py-28">
        <AnimatedSection>
          <p className="text-sm font-medium text-white/60 tracking-wide uppercase mb-4">
            Ready to stop losing jobs?
          </p>
          <h2 className="text-3xl md:text-[2.75rem] font-semibold text-white leading-tight tracking-tight mb-4">
            Your next emergency call
            <br className="hidden sm:block" />
            is tonight.
          </h2>
          <p className="text-lg text-white/70 mb-10 max-w-md mx-auto leading-relaxed">
            Set up your AI receptionist in 5 minutes. No tech skills needed. No credit card required.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-[#0F172A] text-white hover:bg-[#0F172A]/90 min-h-[52px] px-8 text-base font-medium rounded-xl shadow-[0_4px_12px_0_rgba(0,0,0,0.3)] transition-all hover:shadow-[0_8px_24px_0_rgba(0,0,0,0.4)] hover:-translate-y-0.5 group"
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
