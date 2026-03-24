import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import PricingTiers from './PricingTiers';
import ComparisonTable from './ComparisonTable';
import FAQSection from './FAQSection';

export const metadata = {
  title: 'Pricing - Voco',
  description: 'Simple, transparent pricing for AI receptionist service. Every tier pays for itself after one booked job.',
};

export default function PricingPage() {
  return (
    <>
      {/* Hero + Tiers (dark) */}
      <section className="relative bg-[#1A1816] pt-28 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.05)_0%,_transparent_70%)]" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <AnimatedSection>
              <p className="text-sm font-semibold text-[#F97316] tracking-[0.15em] uppercase mb-3">
                Simple, transparent pricing
              </p>
              <h1 className="text-[2rem] md:text-[2.5rem] lg:text-[3rem] font-semibold text-white tracking-tight leading-[1.1]">
                Stop Losing <span className="text-[#F97316]">$1,000 Jobs</span> to Voicemail
              </h1>
              <p className="mt-4 text-base text-white/50 max-w-2xl mx-auto">
                Every tier pays for itself after one booked job. Pick the call volume that matches your crew.
              </p>
            </AnimatedSection>
          </div>
          <PricingTiers />
        </div>
      </section>

      {/* Comparison Table (light) */}
      <section className="bg-[#F5F5F4] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <h2 className="text-2xl font-semibold text-[#0F172A] text-center mb-12 tracking-tight leading-[1.3]">
              Compare Plans
            </h2>
          </AnimatedSection>
          <ComparisonTable />
        </div>
      </section>

      {/* FAQ (light) */}
      <section className="bg-[#F5F5F4] py-20 border-t border-stone-200/60">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <h2 className="text-2xl font-semibold text-[#0F172A] text-center mb-12 tracking-tight leading-[1.3]">
              Frequently Asked Questions
            </h2>
          </AnimatedSection>
          <FAQSection />
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative bg-[#1C1412] py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.1),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <AnimatedSection>
            <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight leading-[1.3]">
              Ready to stop losing jobs to voicemail?
            </h2>
            <p className="mt-4 text-white/50">
              Your AI receptionist is 5 minutes away from answering every call.
            </p>
            <div className="mt-8">
              <Button
                asChild
                className="bg-[#F97316] text-white hover:bg-[#F97316]/90 min-h-[44px] px-8 text-base font-medium rounded-lg shadow-[0_4px_12px_0_rgba(249,115,22,0.3)] hover:shadow-[0_8px_24px_0_rgba(249,115,22,0.4)] transition-all hover:-translate-y-0.5"
              >
                <Link href="/onboarding">Get Started Free</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
