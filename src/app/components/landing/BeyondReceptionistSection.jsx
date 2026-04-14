import { AnimatedSection } from './AnimatedSection';
import {
  PhoneIncoming,
  CalendarCheck,
  UserCheck,
  MessageSquare,
  Receipt,
  BarChart3,
  Check,
  X,
} from 'lucide-react';

const VOCO_ROWS = [
  { icon: PhoneIncoming,  label: 'Answers the call' },
  { icon: CalendarCheck,  label: 'Books the job' },
  { icon: UserCheck,      label: 'Captures the lead' },
  { icon: MessageSquare,  label: 'Sends confirmations' },
  { icon: Receipt,        label: 'Invoices the work' },
  { icon: BarChart3,      label: 'Reports what happened' },
];

const PAIN_KILLS = [
  { pain: 'Lost jobs',    win: 'Every call booked while they\u2019re still on the line' },
  { pain: 'Paperwork',    win: 'Invoices sent before you leave the driveway' },
  { pain: 'Chasing leads', win: 'Missed calls auto-recovered by SMS' },
];

export function BeyondReceptionistSection() {
  return (
    <section id="beyond-receptionist" className="bg-white py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12 md:mb-16 max-w-2xl mx-auto">
            <p className="text-[13px] font-semibold text-[#F97316] tracking-[0.14em] uppercase mb-3">
              Beyond the receptionist
            </p>
            <h2 className="text-3xl md:text-[2.5rem] lg:text-[2.75rem] font-semibold text-[#0F172A] leading-[1.15] tracking-tight">
              Answering the phone is the easy part.
            </h2>
            <p className="text-base md:text-lg text-[#475569] mt-5 leading-relaxed">
              Voco also books the job, captures the lead, sends the invoice, and chases what you miss. One tool, not a stack.
            </p>
          </div>
        </AnimatedSection>

        {/* Comparison grid */}
        <AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-5 md:gap-6">
            {/* Left — AI receptionist (tiny, muted) */}
            <div className="bg-stone-50 border border-stone-200/60 rounded-2xl p-6 md:p-8 flex flex-col">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-stone-500 mb-5">
                Other AI receptionists
              </p>
              <div className="flex items-center gap-3 mb-auto">
                <span className="w-10 h-10 rounded-lg bg-stone-200/70 border border-stone-200 flex items-center justify-center">
                  <PhoneIncoming className="w-5 h-5 text-stone-500" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-[15px] text-stone-600 font-medium">
                  Answer the call.
                </span>
              </div>
              <p className="text-[13px] text-stone-400 italic mt-8">
                That&rsquo;s it.
              </p>
            </div>

            {/* Right — Voco (tall, full stack) */}
            <div className="relative bg-white border border-stone-200/80 rounded-2xl p-6 md:p-8 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] overflow-hidden">
              <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full bg-[#F97316]/80" aria-hidden="true" />
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#F97316] mb-5 ml-3">
                Voco
              </p>
              <ul className="space-y-3 ml-3">
                {VOCO_ROWS.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-[#F97316]/[0.08] border border-[#F97316]/[0.15] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#F97316]" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="text-[15px] text-[#0F172A] font-medium">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </AnimatedSection>

        {/* Pain-kill row */}
        <AnimatedSection>
          <div className="mt-14 md:mt-16 border-t border-stone-100 pt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_KILLS.map(({ pain, win }) => (
              <div key={pain} className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500/80 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-red-600/70 line-through tracking-wide">
                    {pain}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" strokeWidth={2.25} aria-hidden="true" />
                  <span className="text-[14px] text-[#0F172A] font-medium leading-snug">
                    {win}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
