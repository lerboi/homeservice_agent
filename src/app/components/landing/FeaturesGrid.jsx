'use client';
import { Moon, Filter, Calendar, Bell, Globe } from 'lucide-react';
import { AnimatedStagger, AnimatedItem, AnimatedSection } from './AnimatedSection';

const features = [
  {
    icon: Moon,
    title: 'The Night Shift, Sorted',
    body: '24/7 AI answering. No voicemail. No missed leads. Your AI picks up in under a second — at 2 AM on a Sunday, on Christmas morning, during your kid\'s soccer game.',
    justification: 'One $3,000 emergency booking at 2 AM covers your entire month.',
    span: 'md:col-span-4 md:row-span-2',
    variant: 'hero',
  },
  {
    icon: Filter,
    title: 'The Golden Lead Filter',
    body: 'Every call triaged instantly — burst pipe or quote for next month.',
    justification: 'Stop wasting call-back time on tire-kickers.',
    span: 'md:col-span-2',
    variant: 'default',
  },
  {
    icon: Calendar,
    title: 'Money in the Calendar',
    body: 'Emergency calls lock a slot while the caller is still on the line.',
    justification: "Booked means committed. Leads don't cool off.",
    span: 'md:col-span-2',
    variant: 'default',
  },
  {
    icon: Bell,
    title: 'Instant Emergency SMS',
    body: "Burst pipe or gas smell? You get a text in seconds with caller details, urgency level, and job type — not a vague voicemail the next morning.",
    justification: 'Be first on site. Not fastest to call back.',
    span: 'md:col-span-4',
    variant: 'wide',
  },
  {
    icon: Globe,
    title: 'Speaks Their Language',
    body: "Your AI receptionist answers in Spanish, Singlish, or English — switching language the moment it hears the caller. No frustrated hang-ups, no lost leads.",
    justification: 'Every caller heard. Every job captured.',
    span: 'md:col-span-2',
    variant: 'default',
  },
];

function ClockVisual() {
  return (
    <div className="relative mt-6 mb-2">
      <div className="relative mx-auto w-32 h-32">
        <svg viewBox="0 0 128 128" className="w-full h-full" aria-hidden="true">
          <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" className="text-stone-200" strokeWidth="1" />
          <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" className="text-[#F97316]/40" strokeWidth="2" strokeDasharray="365" strokeDashoffset="90" strokeLinecap="round" transform="rotate(-90 64 64)" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line key={deg} x1="64" y1="12" x2="64" y2="16" stroke="currentColor" className="text-stone-300" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${deg} 64 64)`} />
          ))}
          <circle cx="64" cy="64" r="3" fill="currentColor" className="text-[#F97316]" />
          <line x1="64" y1="64" x2="64" y2="34" stroke="currentColor" className="text-stone-500" strokeWidth="2.5" strokeLinecap="round" transform="rotate(30 64 64)" />
          <line x1="64" y1="64" x2="64" y2="24" stroke="currentColor" className="text-stone-400" strokeWidth="1.5" strokeLinecap="round" transform="rotate(180 64 64)" />
        </svg>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[#F97316]/10 border border-[#F97316]/20">
          <span className="text-[11px] font-medium text-[#F97316]">24/7 ACTIVE</span>
        </div>
      </div>
    </div>
  );
}

function MetricBar({ label, value, width }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-stone-400">{label}</span>
        <span className="text-stone-600 font-medium">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-stone-200 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#F97316]/60 to-[#F97316]" style={{ width }} />
      </div>
    </div>
  );
}

function BentoCard({ feature }) {
  const Icon = feature.icon;
  const isHero = feature.variant === 'hero';
  const isWide = feature.variant === 'wide';

  return (
    <AnimatedItem className={feature.span}>
      <div
        className="group relative h-full rounded-2xl overflow-hidden bg-white border border-stone-200/60 shadow-sm p-6 md:p-7 transition-all duration-300 hover:border-[#F97316]/30 hover:shadow-[0_4px_20px_rgba(249,115,22,0.1)] hover:-translate-y-0.5"
      >
        {/* Subtle radial gradient overlay for hero card */}
        {isHero && (
          <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(249,115,22,0.06),transparent_70%)] pointer-events-none" />
        )}

        <div className="relative">
          {/* Icon container */}
          <div className="inline-flex items-center justify-center rounded-xl mb-4 size-11 bg-[#F97316]/[0.08] border border-[#F97316]/[0.12]">
            <Icon
              className="size-5 text-[#F97316]"
              strokeWidth={1.75}
            />
          </div>

          <h3 className={`font-semibold mb-2 text-[#0F172A] ${isHero ? 'text-xl' : 'text-base'}`}>
            {feature.title}
          </h3>

          <p className={`leading-relaxed text-[#475569] ${isHero ? 'text-[15px] max-w-sm' : 'text-sm'}`}>
            {feature.body}
          </p>

          {/* Visual element for hero card */}
          {isHero && <ClockVisual />}

          {/* Metric bars for wide card */}
          {isWide && (
            <div className="mt-5 p-4 rounded-xl bg-stone-50 border border-stone-100 space-y-3">
              <MetricBar label="Emergency calls answered" value="100%" width="100%" />
              <MetricBar label="Avg response time" value="0.8s" width="15%" />
              <MetricBar label="Leads captured" value="98.5%" width="98%" />
            </div>
          )}

          {/* Justification */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-200/60 transition-all duration-300">
            <div className="size-1.5 rounded-full bg-[#166534] shrink-0" />
            <p className="text-sm font-medium text-[#166534]">
              {feature.justification}
            </p>
          </div>
        </div>
      </div>
    </AnimatedItem>
  );
}

export function FeaturesGrid() {
  return (
    <section id="features" className="relative bg-[#F5F5F4] py-20 md:py-28 px-6">
      <div className="relative max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-medium text-[#F97316] tracking-wide uppercase mb-3">
            Why it pays for itself
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] tracking-tight">
            Five features. One question:
            <br className="hidden sm:block" />
            <span className="text-[#475569]">How much did your last missed call cost?</span>
          </h2>
        </AnimatedSection>

        {/* Bento grid — 6-column on md+ for flexible spans */}
        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {features.map((feature) => (
            <BentoCard key={feature.title} feature={feature} />
          ))}
        </AnimatedStagger>
      </div>
    </section>
  );
}
