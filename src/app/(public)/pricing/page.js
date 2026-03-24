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
      <section className="relative bg-[#0F172A] pt-36 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(194,65,12,0.08)_0%,_transparent_70%)]" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <AnimatedSection>
              <h1 className="text-[2.25rem] md:text-[3rem] lg:text-[3.75rem] font-semibold text-white tracking-tight leading-[1.1]">
                Stop Losing <span className="text-[#C2410C]">$1,000 Jobs</span> to Voicemail
              </h1>
              <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
                Every tier pays for itself after one booked job. Pick the call volume that matches your crew.
              </p>
              <p className="mt-4 text-sm text-white/40">No credit card required</p>
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
      <section className="bg-[#F5F5F4] py-20 border-t border-[#0F172A]/5">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <h2 className="text-2xl font-semibold text-[#0F172A] text-center mb-12 tracking-tight leading-[1.3]">
              Frequently Asked Questions
            </h2>
          </AnimatedSection>
          <FAQSection />
        </div>
      </section>

      {/* CTA Banner (dark) */}
      <section className="bg-[#0F172A] py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <AnimatedSection>
            <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight leading-[1.3]">
              Ready to stop losing jobs to voicemail?
            </h2>
            <p className="mt-4 text-white/60">
              Your AI receptionist is 5 minutes away from answering every call.
            </p>
            <div className="mt-8">
              <Button
                asChild
                className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 shadow-[0_4px_16px_0_rgba(194,65,12,0.4)] min-h-[44px] px-8 text-base font-medium rounded-lg"
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
