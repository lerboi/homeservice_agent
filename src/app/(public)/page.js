import dynamic from 'next/dynamic';
import { HeroSection } from '@/app/components/landing/HeroSection';
import { ScrollProgress } from '@/app/components/landing/ScrollProgress';
import { ScrollLinePath } from '@/app/components/landing/ScrollLinePath';
import { PreloadSections } from '@/app/components/landing/PreloadSections';
import { IntegrationsStrip } from '@/app/components/landing/IntegrationsStrip';
import { CostOfSilenceBlock } from '@/app/components/landing/CostOfSilenceBlock';
import { YouStayInControlSection } from '@/app/components/landing/YouStayInControlSection';
import { FinalCTASection } from '@/app/components/landing/FinalCTASection';

// Above-the-fold: HeroSection is statically imported for best LCP.
// Server Component sections (IntegrationsStrip, CostOfSilenceBlock, YouStayInControlSection,
// FinalCTASection) are also statically imported — they render in the initial HTML with zero
// loading state, so scrolling never reveals a skeleton for them.
// Only the heavy 'use client' sections stay code-split; PreloadSections warms their chunks
// during browser idle time right after hydration so the fallbacks below almost never paint.
// Fallbacks reserve each section's height (CLS guard) but stay visually quiet: they match the
// real section background instead of flashing a gray card.
// ScrollLinePath wraps exactly 3 children: IntegrationsStrip, CostOfSilenceBlock, FeaturesCarousel.

const AudioDemoSection = dynamic(
  () => import('@/app/components/landing/AudioDemoSection').then((m) => m.AudioDemoSection),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="h-[420px]" />
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
          <div className="h-[560px]" />
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
          <div className="h-[400px]" />
        </div>
      </section>
    ),
  }
);

export default function HomePage() {
  return (
    <main>
      <ScrollProgress />
      <PreloadSections />
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
