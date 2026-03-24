'use client';
import { Phone, Brain, CalendarCheck } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Phone,
    title: 'Call comes in',
    description:
      'A homeowner calls at 11 PM about a burst pipe. Your AI picks up in under a second.',
    detail: 'No voicemail. No hold music. No missed revenue.',
    extended:
      'While your competitors send callers to voicemail, Voco answers instantly — 24/7, 365 days a year. Every ring is a potential job worth hundreds. Your AI receptionist never sleeps, never takes a break, and never lets revenue slip through the cracks.',
    iconColor: 'text-amber-600',
    bgColor: 'bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50',
    accentGradient: 'from-amber-500/30 to-amber-400/10',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
    numberColor: 'text-amber-400/15',
    borderColor: 'border-amber-200/60',
    shadowColor: 'shadow-amber-200/40',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI triages instantly',
    description:
      'The call is classified as an emergency. Your AI shifts tone — faster, more direct.',
    detail: '"I understand this is urgent. Let me get you scheduled right away."',
    extended:
      'Voco doesn\'t just answer — it thinks. It detects urgency from tone and context, adjusts its response style in real time, and routes emergencies to the front of the queue. Routine calls get handled smoothly. Emergencies get handled now.',
    iconColor: 'text-sky-600',
    bgColor: 'bg-gradient-to-br from-sky-50 via-sky-50/80 to-blue-50',
    accentGradient: 'from-sky-500/30 to-sky-400/10',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
    numberColor: 'text-sky-400/15',
    borderColor: 'border-sky-200/60',
    shadowColor: 'shadow-sky-200/40',
  },
  {
    number: '03',
    icon: CalendarCheck,
    title: 'Job is booked',
    description:
      'First available morning slot is locked while the caller is still on the line.',
    detail: 'You get a text. The homeowner gets confirmation. You sleep.',
    extended:
      'No back-and-forth. No "someone will call you back." The job goes straight into your calendar before the call even ends. You wake up to a full schedule and a confirmed booking — the homeowner already has their time slot.',
    iconColor: 'text-emerald-600',
    bgColor: 'bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-teal-50',
    accentGradient: 'from-emerald-500/30 to-emerald-400/10',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    numberColor: 'text-emerald-400/15',
    borderColor: 'border-emerald-200/60',
    shadowColor: 'shadow-emerald-200/40',
  },
];

export function HowItWorksSticky() {
  return (
    <div className="w-full">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;
        return (
          <div
            key={step.number}
            className={`${step.borderColor} border rounded-3xl sticky min-h-[50vh] p-10 md:p-14 lg:p-16 shadow-lg ${step.shadowColor} overflow-hidden`}
            style={{
              top: '120px',
              zIndex: index + 1,
              marginBottom: '33vh',
              background: 'white',
            }}
          >
            {/* Color gradient overlay */}
            <div className={`absolute inset-0 ${step.bgColor}`} />

            {/* Background decorative number */}
            <span
              className={`absolute -bottom-8 -right-4 text-[14rem] md:text-[20rem] font-black leading-none select-none pointer-events-none ${step.numberColor}`}
            >
              {step.number}
            </span>

            <div className="relative z-10 flex flex-col h-full justify-between min-h-[45vh]">
              {/* Top: badge + icon row */}
              <div>
                <div className="flex items-center justify-between mb-8">
                  <span
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${step.badgeBg}`}
                  >
                    <span className="size-2 rounded-full bg-current opacity-60" />
                    Step {step.number}
                  </span>
                  <div
                    className={`size-14 md:size-16 rounded-2xl bg-gradient-to-br ${step.accentGradient} flex items-center justify-center border border-black/[0.05] backdrop-blur-sm`}
                  >
                    <Icon className={`size-7 md:size-8 ${step.iconColor}`} strokeWidth={1.5} />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-[#0F172A] mb-4 tracking-tight leading-tight">
                  {step.title}
                </h3>

                {/* Divider */}
                <div className={`w-16 h-1 rounded-full bg-gradient-to-r ${step.accentGradient} mb-6`} />

                {/* Description */}
                <p className="text-lg md:text-xl text-[#334155] leading-relaxed mb-4 max-w-2xl">
                  {step.description}
                </p>

                {/* Extended */}
                <p className="text-base text-[#64748B] leading-relaxed max-w-2xl">
                  {step.extended}
                </p>
              </div>

              {/* Bottom: detail quote */}
              <div className="mt-8 pt-6 border-t border-black/[0.06]">
                <p className="text-[15px] text-[#0F172A]/50 italic">
                  {step.detail}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
