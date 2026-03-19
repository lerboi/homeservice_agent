import { Moon, Filter, Calendar, Bell, TrendingUp, Shield } from 'lucide-react';
import { AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { AnimatedSection } from './AnimatedSection';

const features = [
  {
    icon: Moon,
    title: 'The Night Shift, Sorted',
    body: '24/7 AI answering. No voicemail. No missed leads. Your AI picks up in under a second — at 2 AM on a Sunday, on Christmas morning, during your kid\'s soccer game.',
    justification: 'One $3,000 emergency booking at 2 AM covers your entire month.',
    span: 'md:col-span-2 md:row-span-2',
    size: 'large',
    visual: 'clock',
  },
  {
    icon: Filter,
    title: 'The Golden Lead Filter',
    body: 'Every call triaged instantly — burst pipe or quote for next month.',
    justification: 'Stop wasting call-back time on tire-kickers.',
    span: 'md:col-span-1',
    size: 'small',
  },
  {
    icon: Calendar,
    title: 'Money in the Calendar',
    body: 'Emergency calls lock a slot while the caller is still on the line.',
    justification: "Booked means committed. Leads don't cool off.",
    span: 'md:col-span-1',
    size: 'small',
  },
  {
    icon: Bell,
    title: 'Instant Emergency SMS',
    body: "Burst pipe or gas smell? You get a text in seconds with caller details, urgency level, and job type — not a vague voicemail the next morning.",
    justification: 'Be first on site. Not fastest to call back.',
    span: 'md:col-span-2',
    size: 'wide',
  },
];

function ClockVisual() {
  return (
    <div className="relative mt-4 mb-2">
      {/* Animated ring */}
      <div className="relative mx-auto w-32 h-32">
        <svg viewBox="0 0 128 128" className="w-full h-full" aria-hidden="true">
          {/* Outer ring */}
          <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" className="text-white/[0.06]" strokeWidth="1" />
          {/* Progress arc */}
          <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" className="text-[#C2410C]/40" strokeWidth="2" strokeDasharray="365" strokeDashoffset="90" strokeLinecap="round" transform="rotate(-90 64 64)" />
          {/* Hour markers */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line
              key={deg}
              x1="64" y1="12" x2="64" y2="16"
              stroke="currentColor"
              className="text-white/20"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform={`rotate(${deg} 64 64)`}
            />
          ))}
          {/* Center dot */}
          <circle cx="64" cy="64" r="3" fill="currentColor" className="text-[#C2410C]" />
          {/* Hour hand */}
          <line x1="64" y1="64" x2="64" y2="34" stroke="currentColor" className="text-white/60" strokeWidth="2.5" strokeLinecap="round" transform="rotate(30 64 64)" />
          {/* Minute hand */}
          <line x1="64" y1="64" x2="64" y2="24" stroke="currentColor" className="text-white/40" strokeWidth="1.5" strokeLinecap="round" transform="rotate(180 64 64)" />
        </svg>
        {/* Label */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[#C2410C]/10 border border-[#C2410C]/20">
          <span className="text-[11px] font-medium text-[#C2410C]">24/7 ACTIVE</span>
        </div>
      </div>
    </div>
  );
}

function MetricBar({ label, value, width }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-white/40">{label}</span>
        <span className="text-white/60 font-medium">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#C2410C]/60 to-[#C2410C]" style={{ width }} />
      </div>
    </div>
  );
}

export function FeaturesGrid() {
  return (
    <section id="features" className="bg-[#F5F5F4] py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-medium text-[#C2410C] tracking-wide uppercase mb-3">
            Why it pays for itself
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] tracking-tight">
            Four features. One question:
            <br className="hidden sm:block" />
            <span className="text-[#475569]">How much did your last missed call cost?</span>
          </h2>
        </AnimatedSection>

        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-[auto_auto] gap-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isLarge = feature.size === 'large';
            const isWide = feature.size === 'wide';

            return (
              <AnimatedItem key={feature.title} className={feature.span}>
                <div
                  className={`group relative h-full rounded-2xl transition-all duration-300 hover:-translate-y-0.5 overflow-hidden ${
                    isLarge
                      ? 'bg-[#0F172A] text-white p-7 md:p-8 hover:shadow-[0_20px_50px_-15px_rgba(15,23,42,0.5)]'
                      : isWide
                        ? 'bg-white border border-black/[0.06] p-6 md:p-7 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.1)]'
                        : 'bg-white border border-black/[0.06] p-6 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.1)]'
                  }`}
                >
                  {/* Subtle corner gradient on large card */}
                  {isLarge && (
                    <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(circle,rgba(194,65,12,0.12),transparent_70%)]" />
                  )}

                  <div className="relative">
                    {/* Icon */}
                    <div className={`inline-flex items-center justify-center rounded-xl mb-4 ${
                      isLarge
                        ? 'size-12 bg-white/[0.06] border border-white/[0.08]'
                        : 'size-10 bg-[#0F172A]/[0.04]'
                    }`}>
                      <Icon
                        className={`${isLarge ? 'size-5 text-[#C2410C]' : 'size-4.5 text-[#0F172A]/70'}`}
                        strokeWidth={1.75}
                      />
                    </div>

                    <h3 className={`font-semibold mb-2 ${
                      isLarge ? 'text-xl' : 'text-base'
                    }`}>
                      {feature.title}
                    </h3>

                    <p className={`leading-relaxed ${
                      isLarge
                        ? 'text-[15px] text-white/60 max-w-sm'
                        : 'text-sm text-[#475569]'
                    }`}>
                      {feature.body}
                    </p>

                    {/* Visual element for large card */}
                    {isLarge && <ClockVisual />}

                    {/* Metric bars for wide card */}
                    {isWide && (
                      <div className="mt-5 p-4 rounded-xl bg-[#0F172A] space-y-3">
                        <MetricBar label="Emergency calls answered" value="100%" width="100%" />
                        <MetricBar label="Avg response time" value="0.8s" width="15%" />
                        <MetricBar label="Leads captured" value="98.5%" width="98%" />
                      </div>
                    )}

                    {/* Justification */}
                    <div className={`flex items-center gap-2 mt-4 pt-4 ${
                      isLarge ? 'border-t border-white/[0.06]' : 'border-t border-black/[0.04]'
                    }`}>
                      <div className="size-1.5 rounded-full bg-[#166534] shrink-0" />
                      <p className="text-sm font-medium text-[#166534]">
                        {feature.justification}
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedItem>
            );
          })}
        </AnimatedStagger>
      </div>
    </section>
  );
}
