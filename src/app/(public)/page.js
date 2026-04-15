import dynamic from 'next/dynamic';
import { HeroSection } from '@/app/components/landing/HeroSection';
import { ScrollProgress } from '@/app/components/landing/ScrollProgress';
import { ScrollLinePath } from '@/app/components/landing/ScrollLinePath';

// Above-the-fold: HeroSection is statically imported for best LCP.
// Below-the-fold: dynamically imported with loading skeletons to prevent CLS via explicit height reservations.
// Phase 48.1: 7 content sections + FinalCTA ribbon.
// ScrollLinePath wraps exactly 3 children: IntegrationsStrip, CostOfSilenceBlock, FeaturesCarousel.

const AudioDemoSection = dynamic(
  () => import('@/app/components/landing/AudioDemoSection').then((m) => m.AudioDemoSection),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="h-[420px] rounded-2xl bg-white border border-stone-200/70 shadow-sm animate-pulse" />
        </div>
      </section>
    ),
    ssr: false,
  }
);

const IntegrationsStrip = dynamic(
  () => import('@/app/components/landing/IntegrationsStrip').then((m) => m.IntegrationsStrip),
  {
    loading: () => (
      <section className="bg-[#FAFAF9] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="h-[200px] rounded-2xl bg-stone-100/60 animate-pulse" />
        </div>
      </section>
    ),
  }
);

const CostOfSilenceBlock = dynamic(
  () => import('@/app/components/landing/CostOfSilenceBlock').then((m) => m.CostOfSilenceBlock),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-3xl mx-auto text-center">
          <div className="h-[280px] rounded-2xl bg-stone-100/60 animate-pulse" />
        </div>
      </section>
    ),
  }
);

const FeaturesCarousel = dynamic(
  () => import('@/app/components/landing/FeaturesCarousel').then((m) => m.FeaturesCarousel),
  {
    loading: () => (
      <section id="features" className="bg-[#FAFAF9] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-6xl mx-auto">
          <div className="h-[560px] rounded-2xl bg-stone-100/60 animate-pulse" />
        </div>
      </section>
    ),
  }
);

const YouStayInControlSection = dynamic(
  () => import('@/app/components/landing/YouStayInControlSection').then((m) => m.YouStayInControlSection),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="h-[520px] rounded-2xl bg-stone-100/60 animate-pulse" />
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
        <div className="max-w-4xl mx-auto">
          <div className="h-[400px] rounded-2xl bg-stone-100/60 animate-pulse" />
        </div>
      </section>
    ),
  }
);

const FinalCTASection = dynamic(
  () => import('@/app/components/landing/FinalCTASection').then((m) => m.FinalCTASection),
  {
    loading: () => (
      <section className="bg-[#1C1412] py-16" aria-hidden="true">
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-[240px] rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </section>
    ),
  }
);

export default function HomePage() {
  return (
    <main>
      <ScrollProgress />
      <HeroSection />
      <AudioDemoSection />
      <ScrollLinePath>
        <IntegrationsStrip />
        <CostOfSilenceBlock />
        <FeaturesCarousel />
      </ScrollLinePath>
      <YouStayInControlSection />
      <FAQSection />
      <FinalCTASection />
    </main>
  );
}
