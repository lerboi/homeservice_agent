import Link from 'next/link';
import { Phone, Wrench, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AnimatedSection,
  AnimatedStagger,
  AnimatedItem,
} from '@/app/components/landing/AnimatedSection';

export const metadata = {
  title: 'About - Voco',
  description: 'Our mission: ensure no home service call goes unanswered.',
};

export default function AboutPage() {
  return (
    <>
      {/* AboutHero */}
      <section className="relative bg-[#0F172A] pt-36 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(194,65,12,0.08)_0%,_transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <AnimatedSection>
            <h1 className="text-[2.25rem] md:text-[3rem] lg:text-[3.75rem] font-semibold text-white tracking-tight leading-[1.1]">
              Built for the Trades.<br />
              <span className="text-[#C2410C]">By People Who Respect the Work.</span>
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
              We started Voco because we watched skilled tradespeople lose good jobs to voicemail. A plumber in the middle of a pipe repair shouldn&apos;t have to choose between the customer in front of them and the phone ringing in their pocket.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* MissionSection */}
      <section className="bg-[#F5F5F4] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-2xl font-semibold text-[#0F172A] tracking-tight leading-[1.3] mb-6">Our Mission</h2>
              <p className="text-[#475569] text-lg leading-relaxed">
                Every home service business deserves an AI receptionist that answers instantly, books the job, and never lets a lead slip through the cracks. We build the tool that turns every ring into revenue -- so you can focus on the work that matters.
              </p>
            </div>
          </AnimatedSection>

          {/* 3 Core Values */}
          <AnimatedStagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Value 1: Never Miss a Call */}
            <AnimatedItem>
              <div className="bg-white rounded-xl p-8 border border-[#0F172A]/5 shadow-sm">
                <div className="size-12 rounded-lg bg-[#C2410C]/10 flex items-center justify-center mb-5">
                  <Phone className="size-6 text-[#C2410C]" />
                </div>
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Never Miss a Call</h3>
                <p className="text-sm text-[#475569] leading-relaxed">Every ring is a potential $1,000 job. Our AI answers instantly -- 24/7, 365 -- so your phone never goes to voicemail again.</p>
              </div>
            </AnimatedItem>

            {/* Value 2: Built for Trades, Not Tech */}
            <AnimatedItem>
              <div className="bg-white rounded-xl p-8 border border-[#0F172A]/5 shadow-sm">
                <div className="size-12 rounded-lg bg-[#C2410C]/10 flex items-center justify-center mb-5">
                  <Wrench className="size-6 text-[#C2410C]" />
                </div>
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Built for Trades, Not Tech</h3>
                <p className="text-sm text-[#475569] leading-relaxed">5-minute setup. No IT department needed. If you can answer a phone call, you can set up Voco.</p>
              </div>
            </AnimatedItem>

            {/* Value 3: Your Jobs, Your Revenue */}
            <AnimatedItem>
              <div className="bg-white rounded-xl p-8 border border-[#0F172A]/5 shadow-sm">
                <div className="size-12 rounded-lg bg-[#C2410C]/10 flex items-center justify-center mb-5">
                  <DollarSign className="size-6 text-[#C2410C]" />
                </div>
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Your Jobs, Your Revenue</h3>
                <p className="text-sm text-[#475569] leading-relaxed">Every lead captured is a job you would have lost. We track it from first ring to final invoice so you see exactly what your AI earns you.</p>
              </div>
            </AnimatedItem>
          </AnimatedStagger>
        </div>
      </section>

      {/* AboutCTABanner */}
      <section className="bg-[#0F172A] py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <AnimatedSection>
            <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight leading-[1.3]">
              Ready to never miss another call?
            </h2>
            <p className="mt-4 text-white/60">Set up your AI receptionist in under 5 minutes.</p>
            <div className="mt-8">
              <Button asChild className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 shadow-[0_4px_16px_0_rgba(194,65,12,0.4)] min-h-[44px] px-8 text-base font-medium rounded-lg">
                <Link href="/onboarding">Get Started Free</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
