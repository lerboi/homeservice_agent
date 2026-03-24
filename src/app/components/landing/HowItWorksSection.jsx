import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { ArrowRight, Phone, Brain, CalendarCheck } from 'lucide-react';
import dynamic from 'next/dynamic';

const HowItWorksSticky = dynamic(
  () => import('./HowItWorksSticky').then((m) => m.HowItWorksSticky),
  {
    loading: () => (
      <div className="space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[180px] rounded-2xl bg-white border border-stone-200/60 shadow-sm" />
        ))}
      </div>
    ),
  }
);

const mobileSteps = [
  {
    number: '01',
    icon: Phone,
    title: 'Call comes in',
    description: 'A homeowner calls at 11 PM about a burst pipe. Your AI picks up in under a second.',
    detail: 'No voicemail. No hold music. No missed revenue.',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI triages instantly',
    description: 'The call is classified as an emergency. Your AI shifts tone — faster, more direct.',
    detail: '"I understand this is urgent. Let me get you scheduled right away."',
  },
  {
    number: '03',
    icon: CalendarCheck,
    title: 'Job is booked',
    description: 'First available morning slot is locked while the caller is still on the line.',
    detail: 'You get a text. The homeowner gets confirmation. You sleep.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative bg-[#F5F5F4] py-20 md:py-28 px-6">
      <div className="relative max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-semibold text-[#C2410C] tracking-[0.15em] uppercase mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] tracking-tight">
            From missed call to booked job.
            <br className="hidden sm:block" />
            <span className="text-[#475569]">In under two minutes.</span>
          </h2>
        </AnimatedSection>

        {/* Mobile: stacked steps (no JS tabs, no animation complexity) */}
        <div className="block md:hidden space-y-4 mb-16">
          {mobileSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="rounded-2xl bg-white border border-stone-200/60 shadow-sm p-6"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="size-10 rounded-xl bg-[#C2410C]/10 border border-[#C2410C]/20 flex items-center justify-center shrink-0">
                    <Icon className="size-5 text-[#C2410C]" strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-semibold text-[#C2410C] tracking-[0.12em] uppercase">
                    Step {step.number}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-[#475569] leading-relaxed mb-3">
                  {step.description}
                </p>
                <p className="text-xs text-[#475569]/60 italic border-t border-stone-200/60 pt-3">
                  {step.detail}
                </p>
              </div>
            );
          })}
        </div>

        {/* Desktop: sticky scroll component */}
        <div className="hidden md:block">
          <HowItWorksSticky />
        </div>

        <AnimatedSection delay={0.3} className="flex justify-center mt-8">
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
