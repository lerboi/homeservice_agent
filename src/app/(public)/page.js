import { HeroSection } from '@/app/components/landing/HeroSection';
import { ScrollProgress } from '@/app/components/landing/ScrollProgress';
import { ScrollLinePath } from '@/app/components/landing/ScrollLinePath';
import dynamic from 'next/dynamic';

// Above-the-fold: HeroSection is statically imported for best LCP.
// Below-the-fold: dynamically imported with loading skeletons to reduce initial JS bundle
// and prevent CLS via explicit height reservations.

const HowItWorksSection = dynamic(
  () => import('@/app/components/landing/HowItWorksSection').then((m) => m.HowItWorksSection),
  {
    loading: () => (
      <section className="bg-white" aria-hidden="true">
        <div className="pt-24 pb-8 text-center px-6">
          <div className="h-4 w-24 bg-black/10 rounded mx-auto mb-3" />
          <div className="h-10 w-80 bg-black/10 rounded mx-auto" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`min-h-screen ${i % 2 === 0 ? 'bg-[#FAFAF9]' : 'bg-white'}`} />
        ))}
      </section>
    ),
  }
);

const FeaturesCarousel = dynamic(
  () => import('@/app/components/landing/FeaturesCarousel').then((m) => m.FeaturesCarousel),
  {
    loading: () => (
      <section className="bg-[#FAFAF9] py-24 md:py-32 px-6" aria-hidden="true">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="h-4 w-40 bg-black/10 rounded mx-auto mb-3" />
          <div className="h-10 w-96 bg-black/10 rounded mx-auto mb-5" />
          <div className="h-5 w-80 bg-black/5 rounded mx-auto" />
        </div>
        <div className="max-w-[1200px] mx-auto">
          <div className="h-[560px] rounded-3xl bg-white border border-stone-200/70 shadow-sm" />
          <div className="mt-10 h-16 rounded-full bg-white/60 max-w-[640px] mx-auto" />
        </div>
      </section>
    ),
  }
);

const BeyondReceptionistSection = dynamic(
  () => import('@/app/components/landing/BeyondReceptionistSection').then((m) => m.BeyondReceptionistSection),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <div className="h-4 w-40 bg-black/10 rounded mx-auto mb-3" />
            <div className="h-10 w-96 bg-black/10 rounded mx-auto mb-5" />
            <div className="h-5 w-80 bg-black/5 rounded mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-5 md:gap-6">
            <div className="h-[260px] rounded-2xl bg-stone-50 border border-stone-200/60" />
            <div className="h-[420px] rounded-2xl bg-white border border-stone-200/80 shadow-sm" />
          </div>
          <div className="mt-14 md:mt-16 border-t border-stone-100 pt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded bg-black/5" />
            ))}
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
      <section className="bg-[#F5F5F4] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-4 w-24 bg-black/10 rounded mx-auto mb-3" />
            <div className="h-10 w-64 bg-black/10 rounded mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white border border-stone-200/60" />
            ))}
          </div>
        </div>
      </section>
    ),
  }
);

const IdentitySection = dynamic(
  () => import('@/app/components/landing/IdentitySection').then((m) => m.IdentitySection),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-[720px] mx-auto text-center">
          <div className="h-4 w-32 bg-black/10 rounded mx-auto mb-3" />
          <div className="h-8 w-80 bg-black/10 rounded mx-auto mb-8" />
          <div className="h-20 w-full bg-black/5 rounded" />
        </div>
      </section>
    ),
  }
);

const PracticalObjectionsGrid = dynamic(
  () => import('@/app/components/landing/PracticalObjectionsGrid').then((m) => m.PracticalObjectionsGrid),
  {
    loading: () => (
      <section className="bg-[#FAFAF9] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="h-4 w-28 bg-black/10 rounded mx-auto mb-3" />
            <div className="h-10 w-80 bg-black/10 rounded mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-80 rounded-2xl bg-white border border-stone-200/60 shadow-sm" />
            ))}
          </div>
        </div>
      </section>
    ),
  }
);

const OwnerControlPullQuote = dynamic(
  () => import('@/app/components/landing/OwnerControlPullQuote').then((m) => m.OwnerControlPullQuote),
  {
    loading: () => (
      <section className="bg-[#1C1412] py-20 md:py-24 px-6" aria-hidden="true">
        <div className="max-w-2xl mx-auto text-center">
          <div className="h-8 w-96 bg-white/[0.06] rounded mx-auto mb-4" />
          <div className="h-4 w-32 bg-white/[0.04] rounded mx-auto" />
        </div>
      </section>
    ),
  }
);

const FAQSection = dynamic(
  () => import('@/app/components/landing/FAQSection').then((m) => m.FAQSection),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="h-4 w-24 bg-black/10 rounded mx-auto mb-3" />
            <div className="h-10 w-80 bg-black/10 rounded mx-auto" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-14 bg-black/5 rounded-lg" />
              ))}
            </div>
            <div className="h-[400px] rounded-2xl bg-black/5" />
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
      <section className="bg-[#1C1412] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-3xl mx-auto text-center">
          <div className="h-10 w-80 bg-white/[0.06] rounded mx-auto mb-4" />
          <div className="h-6 w-64 bg-white/[0.04] rounded mx-auto" />
        </div>
      </section>
    ),
  }
);

export default function HomePage() {
  return (
    <>
      <ScrollProgress />
      <HeroSection />
      <ScrollLinePath>
        <HowItWorksSection />
        <BeyondReceptionistSection />
        <FeaturesCarousel />
        <SocialProofSection />
      </ScrollLinePath>
      <IdentitySection />
      <PracticalObjectionsGrid />
      <OwnerControlPullQuote />
      <FAQSection />
      <FinalCTASection />
    </>
  );
}
