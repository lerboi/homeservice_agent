import { AnimatedSection } from './AnimatedSection';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';

export function FinalCTASection() {
  return (
    <section id="cta" className="relative overflow-hidden">
      {/* Layered gradient background — warm dark base with orange glow */}
      <div className="absolute inset-0 bg-[#1C1412]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(249,115,22,0.06),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(249,115,22,0.04),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.08),transparent_50%)] animate-cta-glow" />

      <div className="relative max-w-3xl mx-auto text-center px-6 py-20 md:py-28">
        <AnimatedSection>
          <p className="text-sm font-medium text-[#F97316] tracking-wide uppercase mb-4">
            Ready to stop losing jobs?
          </p>
          <h2 className="text-3xl md:text-[2.75rem] font-semibold text-white leading-tight tracking-tight mb-4">
            Your next emergency call
            <br className="hidden sm:block" />
            is tonight.
          </h2>
          <p className="text-lg text-[#A1A1AA] mb-10 max-w-md mx-auto leading-relaxed">
            Your rules. Your schedule. Your customers. Voco just makes sure you don't miss the next one. Live in 5 minutes — no credit card.
          </p>
          <AuthAwareCTA variant="cta" />
        </AnimatedSection>
      </div>
    </section>
  );
}
