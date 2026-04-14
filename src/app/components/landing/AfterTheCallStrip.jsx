import { AnimatedSection } from './AnimatedSection';
import { CalendarCheck, UserCheck, MessageSquare, BarChart3 } from 'lucide-react';

/* ─────────────────────────────────────────
   Inline proof visuals (harvested from the old FeaturesCarousel)
───────────────────────────────────────── */

function BookingVisual() {
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = i + 10;
    return {
      day,
      booked: day === 14,
      locked: day === 15,
      avail: [16, 17, 18, 19, 20].includes(day),
    };
  });

  return (
    <div className="w-full max-w-[220px] mx-auto space-y-2" aria-hidden="true">
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400 font-medium">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ day, booked, locked, avail }) => (
          <div
            key={day}
            className={`aspect-square rounded-md flex items-center justify-center text-[11px] font-medium ${
              booked
                ? 'bg-[#F97316] text-white shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                : locked
                  ? 'bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30'
                  : avail
                    ? 'bg-stone-50 text-stone-500 border border-stone-100'
                    : 'bg-stone-100/50 text-stone-300'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 mt-1 text-[10px] text-stone-500">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-[#F97316] inline-block" /> Booked
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-[#F97316]/20 border border-[#F97316]/30 inline-block" /> Locked
        </span>
      </div>
    </div>
  );
}

function LeadVisual() {
  return (
    <div
      className="w-full max-w-[280px] mx-auto rounded-xl bg-white border border-stone-200/60 px-4 py-4 space-y-2.5 shadow-sm"
      aria-hidden="true"
    >
      {[
        { label: 'Caller',   value: 'James Rivera' },
        { label: 'Address',  value: '42 Oak St, Austin TX' },
        { label: 'Job Type', value: 'Water heater replacement' },
      ].map((field) => (
        <div key={field.label} className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-stone-400 font-medium shrink-0">{field.label}</span>
          <span className="text-[12px] text-[#0F172A] font-medium truncate text-right">{field.value}</span>
        </div>
      ))}
      <div className="pt-1.5 flex items-center justify-between border-t border-stone-100">
        <span className="text-[11px] text-stone-400 font-medium">Urgency</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
          EMERGENCY
        </span>
      </div>
    </div>
  );
}

function SMSVisual() {
  const messages = [
    { text: 'Booking confirmed: Thu 14th @ 9am', sub: 'Smith Plumbing — AC repair', accent: true },
    { text: 'New lead captured', sub: 'Maria Gomez · Burst pipe · URGENT', accent: false },
    { text: 'SMS sent to caller', sub: '2 min ago · Appointment details', accent: false },
  ];

  return (
    <div className="w-full max-w-[300px] mx-auto space-y-2" aria-hidden="true">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${
            m.accent ? 'bg-[#F97316]/[0.08] border border-[#F97316]/20' : 'bg-white border border-stone-200/60'
          }`}
        >
          <div className={`size-1.5 rounded-full mt-1.5 shrink-0 ${m.accent ? 'bg-[#F97316]' : 'bg-stone-400'}`} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#0F172A] truncate">{m.text}</p>
            <p className="text-[11px] text-[#64748B] truncate">{m.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsVisual() {
  const bars = [
    { height: 55, accent: false },
    { height: 75, accent: false },
    { height: 45, accent: false },
    { height: 100, accent: true },
    { height: 80, accent: false },
  ];

  return (
    <div className="w-full max-w-[200px] mx-auto" aria-hidden="true">
      <div className="flex items-end gap-2 h-32">
        {bars.map((bar, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t-md ${bar.accent ? 'bg-[#F97316]' : 'bg-stone-200'}`}
              style={{ height: `${bar.height}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-stone-500">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-[#F97316] inline-block" /> This week
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-stone-200 inline-block" /> Prior week
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Workflow steps — pain-first narrative
───────────────────────────────────────── */

const STEPS = [
  {
    icon: CalendarCheck,
    label: 'Books the job while they\'re still on the line',
    description:
      'Voco reads your live availability, offers a real slot, and locks it in Google or Outlook before the caller hangs up. You don\'t call back. You don\'t check a text thread. The appointment is just there.',
    Visual: BookingVisual,
  },
  {
    icon: UserCheck,
    label: 'Captures every detail as a structured lead',
    description:
      'Name, address, job type, urgency — already typed in. No scribbled notes on a napkin. No 10-minute debrief with your receptionist. You open the dashboard and the whole customer is waiting.',
    Visual: LeadVisual,
  },
  {
    icon: MessageSquare,
    label: 'Notifies you. Confirms them.',
    description:
      'You get an instant SMS with the essentials so you can dispatch before your competitor calls back. The customer gets a confirmation text with the appointment time. Nobody wonders what happened.',
    Visual: SMSVisual,
  },
  {
    icon: BarChart3,
    label: 'Updates your numbers in real time',
    description:
      'Revenue, conversion, missed-call recovery, busiest hours — refreshed the second the call ends. So on a Friday night you can actually see what the week earned, not guess.',
    Visual: AnalyticsVisual,
  },
];

/* ─────────────────────────────────────────
   Main section
───────────────────────────────────────── */

export function AfterTheCallStrip() {
  return (
    <section id="features" className="bg-[#FAFAF9] py-20 md:py-28 px-6">
      <div className="relative z-[1] max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-16 md:mb-20 max-w-2xl mx-auto">
            <p className="text-[13px] font-semibold text-[#F97316] tracking-[0.12em] uppercase mb-3">
              The full-stack workflow
            </p>
            <h2 className="text-3xl md:text-[2.5rem] lg:text-[2.75rem] font-semibold text-[#0F172A] leading-[1.15] tracking-tight">
              You&rsquo;re under the sink. Voco just ran your business.
            </h2>
            <p className="text-base md:text-lg text-[#475569] mt-5 leading-relaxed">
              One inbound call. Four things Voco handled &mdash; while your hands were full.
            </p>
          </div>
        </AnimatedSection>

        <div className="space-y-20 md:space-y-28">
          {STEPS.map(({ icon: Icon, label, description, Visual }, i) => {
            const isReversed = i % 2 === 1;
            return (
              <AnimatedSection key={label}>
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center ${
                    isReversed ? 'md:[&>*:first-child]:order-2' : ''
                  }`}
                >
                  {/* Copy column */}
                  <div>
                    <div className="inline-flex items-center gap-3 mb-5">
                      <span className="w-9 h-9 rounded-full bg-[#F97316]/[0.08] border border-[#F97316]/20 flex items-center justify-center text-sm font-semibold text-[#F97316]">
                        {i + 1}
                      </span>
                      <Icon className="w-5 h-5 text-[#F97316]" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <h3 className="text-xl md:text-2xl lg:text-[1.625rem] font-semibold text-[#0F172A] leading-[1.2] tracking-tight">
                      {label}
                    </h3>
                    <p className="text-base md:text-[17px] text-[#475569] leading-relaxed mt-4">
                      {description}
                    </p>
                  </div>

                  {/* Visual column */}
                  <div className="flex items-center justify-center">
                    <div className="w-full max-w-[380px] bg-white rounded-2xl border border-stone-200/60 p-8 md:p-10 shadow-sm">
                      <Visual />
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>

        <AnimatedSection>
          <p className="text-center text-sm md:text-base text-[#64748B] mt-20 md:mt-28 italic">
            Every call. Every time. While you&rsquo;re somewhere else.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
