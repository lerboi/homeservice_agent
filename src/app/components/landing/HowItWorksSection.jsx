import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { ArrowRight, Phone, Brain, CalendarCheck } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Phone,
    title: 'Call comes in',
    description: 'A homeowner calls at 11 PM about a burst pipe. Your AI picks up in under a second.',
    detail: 'No voicemail. No hold music. No missed revenue.',
    accent: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-600',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI triages instantly',
    description: 'The call is classified as an emergency. Your AI shifts tone — faster, more direct.',
    detail: '"I understand this is urgent. Let me get you scheduled right away."',
    accent: 'from-sky-500/20 to-sky-500/5',
    iconColor: 'text-sky-600',
  },
  {
    number: '03',
    icon: CalendarCheck,
    title: 'Job is booked',
    description: 'First available morning slot is locked while the caller is still on the line.',
    detail: 'You get a text. The homeowner gets confirmation. You sleep.',
    accent: 'from-emerald-500/20 to-emerald-500/5',
    iconColor: 'text-emerald-600',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative bg-white py-20 md:py-28 px-6 overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative max-w-5xl mx-auto">
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

        <AnimatedStagger className="space-y-4 md:space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <AnimatedItem key={step.number}>
                <div className="group relative rounded-2xl border border-black/[0.04] bg-[#F5F5F4]/50 p-6 md:p-8 transition-all duration-300 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] hover:border-black/[0.06]">
                  <div className="md:flex md:items-start md:gap-8">
                    {/* Step indicator */}
                    <div className="flex items-center gap-4 md:flex-col md:items-center md:gap-2 mb-4 md:mb-0 md:pt-1">
                      <div className={`relative size-14 rounded-2xl bg-gradient-to-br ${step.accent} flex items-center justify-center shrink-0 border border-black/[0.04]`}>
                        <Icon className={`size-6 ${step.iconColor}`} strokeWidth={1.5} />
                      </div>
                      <span className="text-xs font-mono font-medium text-[#475569]/60 tracking-wider">
                        STEP {step.number}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-[#0F172A] mb-1.5">
                        {step.title}
                      </h3>
                      <p className="text-[15px] text-[#475569] leading-relaxed">
                        {step.description}
                      </p>
                      <p className="text-sm text-[#0F172A]/50 mt-2 italic">
                        {step.detail}
                      </p>
                    </div>

                    {/* Step number (large, decorative — desktop) */}
                    <div className="hidden md:block text-7xl font-semibold text-black/[0.03] leading-none select-none">
                      {step.number}
                    </div>
                  </div>
                </div>
              </AnimatedItem>
            );
          })}
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
