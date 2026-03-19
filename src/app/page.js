import { LandingNav } from './components/landing/LandingNav';
import { HeroSection } from './components/landing/HeroSection';
import { HowItWorksSection } from './components/landing/HowItWorksSection';
import { FeaturesGrid } from './components/landing/FeaturesGrid';
import { SocialProofSection } from './components/landing/SocialProofSection';
import { FinalCTASection } from './components/landing/FinalCTASection';
import { LandingFooter } from './components/landing/LandingFooter';

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesGrid />
        <SocialProofSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </>
  );
}
