import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import PricingTiers from './PricingTiers';
import ROICalculator from './ROICalculator';
import ComparisonTable from './ComparisonTable';
import FAQSection from './FAQSection';

export const metadata = {
  title: 'Pricing — Voco AI Receptionist',
  description: 'Simple, transparent pricing for AI receptionist service. Every tier pays for itself after one booked job.',
};

export default function PricingPage() {
  return (
    <>
      {/* Hero + Tiers (dark) */}
      <section className="relative bg-[#050505] pt-24 pb-14 overflow-hidden">
        {/* Radial gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.06),transparent_70%)] pointer-events-none" />
        {/* Dot-grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        {/* Blur orb */}
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#F97316]/[0.03] blur-[100px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6">
          {/* Hero content */}
          <div className="max-w-4xl mx-auto text-center mb-6">
            <AnimatedSection>
              {/* Eyebrow pill */}
              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.07]">
                  <span className="size-1.5 rounded-full bg-[#F97316] animate-pulse" />
                  <span className="text-xs font-semibold text-white/70 tracking-wide uppercase">AI Receptionist for Trades</span>
                </div>
              </div>
              {/* Headline */}
              <h1 className="text-[2.25rem] md:text-[2.75rem] lg:text-[3rem] font-semibold text-white tracking-tight leading-[1.1]">
                Stop Losing <span className="text-[#F97316]">$1,000 Jobs</span> to Voicemail
              </h1>
              {/* Subline */}
              <p className="mt-3 text-base text-white/50 max-w-xl mx-auto">
                Every plan pays for itself after one booked job. Pick the volume that matches your crew.
              </p>
            </AnimatedSection>
          </div>
          <div id="pricing-plans">
            <PricingTiers />
          </div>

          {/* Guarantee Badge — inside same section, no background break */}
          <div className="mt-10 max-w-3xl mx-auto">
            <AnimatedSection>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                <div className="flex items-center justify-center size-12 rounded-full bg-[#F97316]/[0.08] shrink-0">
                  <ShieldCheck className="size-6 text-[#F97316]" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Risk-Free Guarantee</p>
                  <p className="text-sm text-white/45 mt-0.5">
                    Try Voco free for 14 days with real calls. If it doesn&apos;t book you a job, you pay nothing. Cancel anytime &mdash; no contracts, no fees.
                  </p>
                </div>
              </div>
            </AnimatedSection>
          </div>

        </div>
      </section>

      {/* ROI Calculator (warm light) */}
      <section className="relative bg-[#EDEAE7] py-16">
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-[#EDEAE7] to-[#F5F5F4] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <ROICalculator />
        </div>
      </section>

      {/* Comparison Table (light) */}
      <section className="bg-[#F5F5F4] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <ComparisonTable />
        </div>
      </section>

      {/* FAQ (dark) */}
      <section className="bg-[#050505] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <h2 className="text-2xl font-semibold text-white text-center mb-12 tracking-tight leading-[1.3]">
              Questions from the field
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
              Every missed call is a job your competitor booked.
            </h2>
            <p className="mt-4 text-white/50">
              Your AI receptionist is 5 minutes away.
            </p>
            <div className="mt-8">
              <Button
                asChild
                className="bg-[#F97316] text-white hover:bg-[#F97316]/90 min-h-[44px] px-8 text-base font-medium rounded-lg shadow-[0_4px_12px_0_rgba(249,115,22,0.3)] hover:shadow-[0_8px_24px_0_rgba(249,115,22,0.4)] transition-all hover:-translate-y-0.5"
              >
                <a href="#pricing-plans">Start Free Trial</a>
              </Button>
            </div>
            <p className="text-sm text-white/40 mt-3">14-day free trial. Cancel anytime.</p>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
