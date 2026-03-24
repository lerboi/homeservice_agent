import { HeroSection } from '@/app/components/landing/HeroSection';
import dynamic from 'next/dynamic';

// Above-the-fold: HeroSection is statically imported for best LCP.
// Below-the-fold: dynamically imported with loading skeletons to reduce initial JS bundle
// and prevent CLS via explicit height reservations.

const HowItWorksSection = dynamic(
  () => import('@/app/components/landing/HowItWorksSection').then((m) => m.HowItWorksSection),
  {
    loading: () => (
      <section className="bg-[#F5F5F4] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-4 w-24 bg-black/10 rounded mx-auto mb-3" />
            <div className="h-10 w-80 bg-black/10 rounded mx-auto" />
          </div>
          <div className="space-y-4">
            <div className="flex gap-2 justify-center mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 w-16 rounded-lg bg-black/[0.04]" />
              ))}
            </div>
            <div className="h-[280px] rounded-2xl bg-white border border-stone-200/60" />
          </div>
        </div>
      </section>
    ),
  }
);

const FeaturesGrid = dynamic(
  () => import('@/app/components/landing/FeaturesGrid').then((m) => m.FeaturesGrid),
  {
    loading: () => (
      <section className="bg-[#0F172A] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-4 w-32 bg-white/10 rounded mx-auto mb-3" />
            <div className="h-10 w-96 bg-white/10 rounded mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-4 md:row-span-2 h-64 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
            <div className="md:col-span-2 h-40 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
            <div className="md:col-span-2 h-40 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
            <div className="md:col-span-4 h-40 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
            <div className="md:col-span-2 h-40 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
          </div>
        </div>
      </section>
    ),
  }
);

const SocialProofSection = dynamic(
  () => import('@/app/components/landing/SocialProofSection').then((m) => m.SocialProofSection),
  {
    loading: () => (
      <section className="bg-[#1E293B] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-4 w-24 bg-white/10 rounded mx-auto mb-3" />
            <div className="h-10 w-64 bg-white/10 rounded mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
            ))}
          </div>
        </div>
      </section>
    ),
  }
);

const FinalCTASection = dynamic(
  () => import('@/app/components/landing/FinalCTASection').then((m) => m.FinalCTASection),
  {
    loading: () => (
      <section className="bg-[#C2410C] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-3xl mx-auto text-center">
          <div className="h-10 w-80 bg-white/20 rounded mx-auto mb-4" />
          <div className="h-6 w-64 bg-white/10 rounded mx-auto" />
        </div>
      </section>
    ),
  }
);

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <FeaturesGrid />
      <SocialProofSection />
      <FinalCTASection />
    </>
  );
}
