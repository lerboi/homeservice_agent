'use client';
import { Moon, Filter, Calendar, Bell, Globe } from 'lucide-react';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';

function ClockVisual() {
  return (
    <div className="relative mx-auto w-36 h-36 md:w-44 md:h-44">
      <svg viewBox="0 0 128 128" className="w-full h-full" aria-hidden="true">
        <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" className="text-stone-200" strokeWidth="0.75" />
        {/* Animated progress arc */}
        <circle
          cx="64" cy="64" r="58" fill="none" stroke="currentColor"
          className="text-[#F97316]/50"
          strokeWidth="2" strokeDasharray="365" strokeDashoffset="90"
          strokeLinecap="round" transform="rotate(-90 64 64)"
          style={{ animation: 'clockSpin 8s linear infinite' }}
        />
        {/* Hour markers */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <line key={deg} x1="64" y1="10" x2="64" y2="15" stroke="currentColor" className="text-stone-300" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${deg} 64 64)`} />
        ))}
        <circle cx="64" cy="64" r="3.5" fill="currentColor" className="text-[#F97316]" />
        <line x1="64" y1="64" x2="64" y2="30" stroke="currentColor" className="text-[#0F172A]" strokeWidth="2.5" strokeLinecap="round" transform="rotate(30 64 64)" />
        <line x1="64" y1="64" x2="64" y2="22" stroke="currentColor" className="text-stone-400" strokeWidth="1.5" strokeLinecap="round" transform="rotate(180 64 64)" />
      </svg>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#F97316]/10 border border-[#F97316]/20">
        <span className="text-[11px] font-semibold text-[#F97316] tracking-wide">24/7 ACTIVE</span>
      </div>
      <style jsx>{`
        @keyframes clockSpin {
          from { stroke-dashoffset: 365; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
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
      <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#F97316]/60 to-[#F97316]"
          style={{ width, transition: 'width 1s ease-out' }}
        />
      </div>
    </div>
  );
}

function TriageVisual() {
  return (
    <div className="space-y-2.5">
      {[
        { label: 'Burst pipe — flooding', tag: 'EMERGENCY', color: 'bg-red-500', tagBg: 'bg-red-50 text-red-700 border-red-200' },
        { label: 'Quote for next month', tag: 'ROUTINE', color: 'bg-[#F97316]', tagBg: 'bg-orange-50 text-[#C2410C] border-orange-200' },
        { label: 'Pool heater install', tag: 'HIGH TICKET', color: 'bg-emerald-500', tagBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-3 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2.5">
          <div className={`size-2 rounded-full ${item.color} shrink-0`} />
          <span className="text-xs text-[#475569] flex-1 truncate">{item.label}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.tagBg}`}>{item.tag}</span>
        </div>
      ))}
    </div>
  );
}

function LanguageVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {['EN', 'ES', 'SG'].map((lang, i) => (
          <div
            key={lang}
            className={`size-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              i === 0
                ? 'bg-[#F97316] text-white border-[#F97316] shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                : 'bg-white text-[#475569] border-stone-200'
            }`}
          >
            {lang}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="size-1.5 rounded-full bg-[#166534] animate-pulse" />
        <span className="text-[11px] text-[#166534] font-medium">Auto-detecting...</span>
      </div>
    </div>
  );
}

export function FeaturesGrid() {
  return (
    <section id="features" className="bg-[#FAFAF9] py-20 md:py-28 px-6">
      <div className="relative z-[1] max-w-5xl mx-auto">
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

        {/* Bento grid — joined cards */}
        <AnimatedStagger className="grid grid-cols-1 sm:grid-cols-5 gap-px bg-stone-200/80 rounded-2xl overflow-hidden shadow-sm">

          {/* Card 1: The Night Shift — 3 col top-left */}
          <AnimatedItem className="sm:col-span-3 bg-white">
            <div className="h-full p-6 md:p-8 flex flex-col">
              <div className="flex items-start gap-4 mb-6">
                <div className="inline-flex items-center justify-center rounded-xl size-11 bg-[#F97316]/[0.08] border border-[#F97316]/[0.12] shrink-0">
                  <Moon className="size-5 text-[#F97316]" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#0F172A]">The Night Shift, Sorted</h3>
                  <p className="text-sm text-[#475569] mt-1 leading-relaxed max-w-sm">
                    24/7 AI answering. No voicemail. No missed leads. Your AI picks up in under a second — at 2 AM on a Sunday, during your kid&apos;s soccer game.
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center py-4">
                <ClockVisual />
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-100">
                <div className="size-1.5 rounded-full bg-[#166534] shrink-0" />
                <p className="text-sm font-medium text-[#166534]">One $3,000 emergency booking at 2 AM covers your entire month.</p>
              </div>
            </div>
          </AnimatedItem>

          {/* Card 2: Golden Lead Filter — 2 col top-right */}
          <AnimatedItem className="sm:col-span-2 bg-white">
            <div className="h-full p-6 md:p-8 flex flex-col">
              <div className="inline-flex items-center justify-center rounded-xl mb-4 size-11 bg-[#F97316]/[0.08] border border-[#F97316]/[0.12]">
                <Filter className="size-5 text-[#F97316]" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-1">The Golden Lead Filter</h3>
              <p className="text-sm text-[#475569] leading-relaxed mb-6">Every call triaged instantly — burst pipe or quote for next month.</p>
              <div className="flex-1 flex items-end">
                <div className="w-full">
                  <TriageVisual />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-stone-100">
                <div className="size-1.5 rounded-full bg-[#166534] shrink-0" />
                <p className="text-sm font-medium text-[#166534]">Stop wasting call-back time on tire-kickers.</p>
              </div>
            </div>
          </AnimatedItem>

          {/* Card 3: Money in the Calendar — 2 col bottom-left */}
          <AnimatedItem className="sm:col-span-2 bg-white">
            <div className="h-full p-6 md:p-8 flex flex-col">
              <div className="inline-flex items-center justify-center rounded-xl mb-4 size-11 bg-[#F97316]/[0.08] border border-[#F97316]/[0.12]">
                <Calendar className="size-5 text-[#F97316]" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] text-center sm:text-left mb-1">Money in the Calendar</h3>
              <p className="text-sm text-[#475569] leading-relaxed text-center sm:text-left mb-6">Emergency calls lock a slot while the caller is still on the line.</p>
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-[200px] space-y-2">
                  {/* Mini calendar visual */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400 font-medium">
                    {['M','T','W','T','F','S','S'].map((d, i) => <span key={i}>{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 14 }, (_, i) => {
                      const day = i + 10;
                      const isBooked = day === 14;
                      const isLocked = day === 15;
                      const isAvail = [16, 17, 18, 19, 20].includes(day);
                      return (
                        <div
                          key={i}
                          className={`aspect-square rounded-md flex items-center justify-center text-[11px] font-medium transition-all ${
                            isBooked
                              ? 'bg-[#F97316] text-white shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                              : isLocked
                                ? 'bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30'
                                : isAvail
                                  ? 'bg-stone-50 text-stone-500 border border-stone-100'
                                  : 'bg-stone-100/50 text-stone-300'
                          }`}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-2 text-[10px]">
                    <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#F97316]" /> Booked</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#F97316]/20 border border-[#F97316]/30" /> Locked</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-stone-100">
                <div className="size-1.5 rounded-full bg-[#166534] shrink-0" />
                <p className="text-sm font-medium text-[#166534]">Booked means committed. Leads don&apos;t cool off.</p>
              </div>
            </div>
          </AnimatedItem>

          {/* Card 4: Instant Emergency SMS — 3 col bottom-right */}
          <AnimatedItem className="sm:col-span-3 bg-white">
            <div className="h-full p-6 md:p-8 flex flex-col">
              <div className="flex items-start gap-4 mb-6">
                <div className="inline-flex items-center justify-center rounded-xl size-11 bg-[#F97316]/[0.08] border border-[#F97316]/[0.12] shrink-0">
                  <Bell className="size-5 text-[#F97316]" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#0F172A]">Instant Emergency SMS</h3>
                  <p className="text-sm text-[#475569] mt-1 leading-relaxed max-w-sm">
                    Burst pipe or gas smell? You get a text in seconds with caller details, urgency level, and job type.
                  </p>
                </div>
              </div>
              <div className="flex-1">
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-4 space-y-3">
                  <MetricBar label="Emergency calls answered" value="100%" width="100%" />
                  <MetricBar label="Avg response time" value="0.8s" width="15%" />
                  <MetricBar label="Leads captured" value="98.5%" width="98%" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-stone-100">
                <div className="size-1.5 rounded-full bg-[#166534] shrink-0" />
                <p className="text-sm font-medium text-[#166534]">Be first on site. Not fastest to call back.</p>
              </div>
            </div>
          </AnimatedItem>

          {/* Card 5: Speaks Their Language — full width bottom */}
          <AnimatedItem className="sm:col-span-5 bg-white">
            <div className="p-6 md:py-8 md:px-10 flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="inline-flex items-center justify-center rounded-xl size-11 bg-[#F97316]/[0.08] border border-[#F97316]/[0.12] shrink-0 sm:self-start">
                <Globe className="size-5 text-[#F97316]" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-[#0F172A] mb-1">Speaks Their Language</h3>
                <p className="text-sm text-[#475569] leading-relaxed max-w-lg">
                  Your AI receptionist answers in Spanish, Singlish, or English — switching language the moment it hears the caller. No frustrated hang-ups, no lost leads.
                </p>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-100">
                  <div className="size-1.5 rounded-full bg-[#166534] shrink-0" />
                  <p className="text-sm font-medium text-[#166534]">Every caller heard. Every job captured.</p>
                </div>
              </div>
              <div className="shrink-0 flex justify-center">
                <LanguageVisual />
              </div>
            </div>
          </AnimatedItem>

        </AnimatedStagger>
      </div>
    </section>
  );
}
