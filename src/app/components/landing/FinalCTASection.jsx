import { AnimatedSection } from './AnimatedSection';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';

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
          <AuthAwareCTA variant="cta" />
        </AnimatedSection>
      </div>
    </section>
  );
}
