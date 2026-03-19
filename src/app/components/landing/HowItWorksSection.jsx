import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Call comes in',
    description: 'A homeowner calls at 11 PM about a burst pipe. Your AI picks up in under a second — no voicemail, no hold music.',
  },
  {
    number: '02',
    title: 'AI triages instantly',
    description: 'The call is classified as an emergency. Your AI shifts tone — faster, more direct. "I understand this is urgent. Let me get you scheduled right away."',
  },
  {
    number: '03',
    title: 'Job is booked',
    description: 'First available morning slot is locked while the caller is still on the line. You get a text. The homeowner gets confirmation. You sleep.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative bg-[#F5F5F4] py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-medium text-[#C2410C] tracking-wide uppercase mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] tracking-tight">
            From missed call to booked job.
            <br className="hidden sm:block" />
            <span className="text-[#475569]">In under two minutes.</span>
          </h2>
        </AnimatedSection>

        <AnimatedStagger className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-8 left-[calc(16.67%+12px)] right-[calc(16.67%+12px)] h-px bg-gradient-to-r from-[#C2410C]/30 via-[#C2410C]/20 to-[#C2410C]/30" />

          {steps.map((step) => (
            <AnimatedItem key={step.number}>
              <div className="relative">
                {/* Step number circle */}
                <div className="relative z-10 size-16 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-semibold text-lg mb-5 shadow-[0_2px_8px_0_rgba(15,23,42,0.2)]">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                  {step.title}
                </h3>
                <p className="text-[15px] text-[#475569] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedStagger>

        <AnimatedSection delay={0.3} className="flex justify-center mt-14">
          <Button
            asChild
            size="lg"
            className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 min-h-[48px] px-6 text-[15px] font-medium rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_4px_16px_0_rgba(194,65,12,0.4)] hover:-translate-y-0.5 group"
          >
            <Link href="/onboarding">
              Start My 5-Minute Setup
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </AnimatedSection>
      </div>
    </section>
  );
}
