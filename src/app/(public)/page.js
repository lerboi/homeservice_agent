import { HeroSection } from '@/app/components/landing/HeroSection';
import { HowItWorksSection } from '@/app/components/landing/HowItWorksSection';
import { FeaturesGrid } from '@/app/components/landing/FeaturesGrid';
import { SocialProofSection } from '@/app/components/landing/SocialProofSection';
import { FinalCTASection } from '@/app/components/landing/FinalCTASection';

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
