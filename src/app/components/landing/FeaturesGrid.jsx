'use client';
import { Globe, PhoneIncoming, CalendarCheck, MessageSquare, BarChart3, UserCheck, RefreshCw } from 'lucide-react';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';

/* ─────────────────────────────────────────
   Micro Visual: 70+ Languages (hero card)
───────────────────────────────────────── */
function LanguageHeroVisual() {
  const bubbles = [
    { label: 'EN', x: '10%',  y: '15%', delay: '0s',   size: 40, accent: false },
    { label: 'ES', x: '55%',  y: '5%',  delay: '0.5s', size: 40, accent: false },
    { label: 'ZH', x: '75%',  y: '45%', delay: '1s',   size: 36, accent: false },
    { label: 'MS', x: '20%',  y: '60%', delay: '1.5s', size: 36, accent: false },
    { label: '70+', x: '48%', y: '52%', delay: '2s',   size: 48, accent: true  },
  ];

  return (
    <div className="relative w-48 h-36 md:w-56 md:h-40 shrink-0" aria-hidden="true">
      {bubbles.map((b) => (
        <div
          key={b.label}
          className={`absolute rounded-full flex items-center justify-center text-xs font-bold border-2 ${
            b.accent
              ? 'bg-[#F97316] text-white border-[#F97316] shadow-[0_0_12px_rgba(249,115,22,0.3)]'
              : 'bg-white text-[#475569] border-stone-200 shadow-sm'
          }`}
          style={{
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            animation: `langFloat 3s ease-in-out ${b.delay} infinite`,
          }}
        >
          {b.label}
        </div>
      ))}
      <style jsx>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes langFloat {
            0%, 100% { transform: translateY(0px); }
            50%       { transform: translateY(-8px); }
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: 24/7 AI Answering
───────────────────────────────────────── */
function AnsweringVisual() {
  return (
    <div className="relative mx-auto w-32 h-36" aria-hidden="true">
      <svg viewBox="0 0 128 128" className="w-32 h-32" aria-hidden="true">
        {/* Outer circle track */}
        <circle cx="64" cy="64" r="54" fill="none" stroke="currentColor" className="text-stone-100" strokeWidth="1" />
        {/* Animated progress arc */}
        <circle
          cx="64" cy="64" r="54" fill="none" stroke="currentColor"
          className="text-[#F97316]/50"
          strokeWidth="3" strokeDasharray="339" strokeDashoffset="339"
          strokeLinecap="round" transform="rotate(-90 64 64)"
          style={{ animation: 'clockSpin 8s linear infinite' }}
        />
        {/* Hour markers */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <line
            key={deg} x1="64" y1="12" x2="64" y2="18"
            stroke="currentColor" className="text-stone-300"
            strokeWidth="1.5" strokeLinecap="round"
            transform={`rotate(${deg} 64 64)`}
          />
        ))}
        {/* Center dot */}
        <circle cx="64" cy="64" r="3.5" fill="currentColor" className="text-[#F97316]" />
        {/* Hour hand */}
        <line x1="64" y1="64" x2="64" y2="30" stroke="currentColor" className="text-[#0F172A]" strokeWidth="2.5" strokeLinecap="round" transform="rotate(30 64 64)" />
        {/* Minute hand */}
        <line x1="64" y1="64" x2="64" y2="22" stroke="currentColor" className="text-stone-400" strokeWidth="1.5" strokeLinecap="round" transform="rotate(180 64 64)" />
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#F97316]/10 border border-[#F97316]/20 whitespace-nowrap">
        <span className="text-[11px] font-semibold text-[#F97316] tracking-wide">24/7 ACTIVE</span>
      </div>
      <style jsx>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes clockSpin {
            from { stroke-dashoffset: 339; }
            to   { stroke-dashoffset: 0; }
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Real-Time Calendar Booking
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
    <div className="w-full max-w-[200px] mx-auto space-y-2" aria-hidden="true">
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

/* ─────────────────────────────────────────
   Micro Visual: Post-Call SMS & Notifications
───────────────────────────────────────── */
function SMSVisual() {
  const messages = [
    { text: 'Booking confirmed: Thu 14th @ 9am', sub: 'Smith Plumbing — AC repair', accent: true },
    { text: 'New lead captured', sub: 'Maria Gomez · Burst pipe · URGENT', accent: false },
    { text: 'SMS sent to caller', sub: '2 min ago · Appointment details', accent: false },
  ];

  return (
    <div className="w-full space-y-2" aria-hidden="true">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${
            m.accent ? 'bg-[#F97316]/[0.08] border border-[#F97316]/20' : 'bg-stone-50 border border-stone-100'
          }`}
        >
          <div className={`size-1.5 rounded-full mt-1.5 shrink-0 ${m.accent ? 'bg-[#F97316]' : 'bg-stone-400'}`} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#0F172A] truncate">{m.text}</p>
            <p className="text-[10px] text-[#64748B] truncate">{m.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Call Analytics & Dashboard
───────────────────────────────────────── */
function AnalyticsVisual() {
  const bars = [
    { height: 55, accent: false },
    { height: 75, accent: false },
    { height: 45, accent: false },
    { height: 100, accent: true },
    { height: 80, accent: false },
  ];

  return (
    <div className="w-full max-w-[160px] mx-auto" aria-hidden="true">
      <div className="flex items-end gap-2 h-28">
        {bars.map((bar, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t-md ${bar.accent ? 'bg-[#F97316]' : 'bg-stone-200'}`}
              style={{ height: `${bar.height}%`, animation: `barGrow 1s ease-out ${i * 0.1}s both` }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-stone-400">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-[#F97316] inline-block" /> This week
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-stone-200 inline-block" /> Prior week
        </span>
      </div>
      <style jsx>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes barGrow {
            from { transform: scaleY(0); transform-origin: bottom; }
            to   { transform: scaleY(1); transform-origin: bottom; }
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Lead Capture & CRM
───────────────────────────────────────── */
function LeadVisual() {
  return (
    <div
      className="w-full rounded-xl bg-stone-50 border border-stone-100 px-3 py-3 space-y-2"
      aria-hidden="true"
    >
      {[
        { label: 'Caller', value: 'James Rivera' },
        { label: 'Address', value: '42 Oak St, Austin TX' },
        { label: 'Job Type', value: 'Water heater replacement' },
      ].map((field) => (
        <div key={field.label} className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-stone-400 font-medium shrink-0">{field.label}</span>
          <span className="text-[11px] text-[#0F172A] font-medium truncate text-right">{field.value}</span>
        </div>
      ))}
      <div className="pt-1 flex items-center justify-between">
        <span className="text-[10px] text-stone-400 font-medium">Urgency</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
          EMERGENCY
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Google & Outlook Calendar Sync
───────────────────────────────────────── */
function CalSyncVisual() {
  return (
    <div className="flex items-center justify-center gap-4" aria-hidden="true">
      {/* Google Calendar icon */}
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="40" height="36" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <rect x="2" y="6" width="40" height="10" rx="4" fill="#f1f5f9" />
        <rect x="2" y="12" width="40" height="4" fill="#f1f5f9" />
        <line x1="12" y1="6" x2="12" y2="2" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="6" x2="32" y2="2" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <rect x="10" y="22" width="8" height="8" rx="1.5" fill="#F97316" opacity="0.8" />
        <rect x="26" y="30" width="8" height="8" rx="1.5" fill="#F97316" opacity="0.4" />
      </svg>

      {/* Bidirectional arrows */}
      <div className="flex flex-col items-center gap-1">
        <svg width="24" height="10" viewBox="0 0 24 10" fill="none" aria-hidden="true">
          <path d="M2 5H22M18 1L22 5L18 9" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg width="24" height="10" viewBox="0 0 24 10" fill="none" aria-hidden="true">
          <path d="M22 5H2M6 1L2 5L6 9" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Outlook icon */}
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="40" height="36" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <rect x="2" y="6" width="40" height="10" rx="4" fill="#f0f9ff" />
        <rect x="2" y="12" width="40" height="4" fill="#f0f9ff" />
        <line x1="12" y1="6" x2="12" y2="2" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="6" x2="32" y2="2" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <rect x="10" y="22" width="8" height="8" rx="1.5" fill="#0ea5e9" opacity="0.6" />
        <rect x="26" y="30" width="8" height="8" rx="1.5" fill="#0ea5e9" opacity="0.3" />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────
   Feature card data
───────────────────────────────────────── */
const FEATURES = [
  {
    icon: PhoneIncoming,
    title: '24/7 AI Answering',
    description: 'Your AI receptionist picks up in under a second — at 2 AM on a Sunday or during your kid\'s soccer game. Zero voicemail. Zero missed leads.',
    microValue: 'One emergency booking at 2 AM covers your entire month.',
    Visual: AnsweringVisual,
  },
  {
    icon: CalendarCheck,
    title: 'Real-Time Calendar Booking',
    description: 'Emergency jobs get locked into your calendar while the caller is still on the line. No follow-up. No back-and-forth. Job confirmed.',
    microValue: 'Booked means committed — leads don\'t cool off.',
    Visual: BookingVisual,
  },
  {
    icon: MessageSquare,
    title: 'Post-Call SMS & Notifications',
    description: 'Burst pipe or gas smell? You get a text in seconds with caller details, urgency level, and job type — so you can dispatch before competitors even call back.',
    microValue: 'Be first on site, not fastest to call back.',
    Visual: SMSVisual,
  },
  {
    icon: BarChart3,
    title: 'Call Analytics & Dashboard',
    description: 'See every call, lead, and booking in one place. Know which calls converted, which slipped away, and where your busiest hours are.',
    microValue: null,
    Visual: AnalyticsVisual,
  },
  {
    icon: UserCheck,
    title: 'Lead Capture & CRM',
    description: 'Every caller becomes a structured lead — name, address, job type, urgency — automatically logged to your CRM. No manual data entry ever again.',
    microValue: null,
    Visual: LeadVisual,
  },
  {
    icon: RefreshCw,
    title: 'Google & Outlook Calendar Sync',
    description: 'Two-way sync keeps your existing Google or Outlook calendar in perfect sync. Book via Voco and it shows up everywhere, instantly.',
    microValue: null,
    Visual: CalSyncVisual,
  },
];

/* ─────────────────────────────────────────
   Main export
───────────────────────────────────────── */
export function FeaturesGrid() {
  return (
    <section id="features" className="bg-[#FAFAF9] py-20 md:py-28 px-6">
      <div className="relative z-[1] max-w-5xl mx-auto">

        {/* Section heading */}
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-semibold text-[#F97316] tracking-[0.15em] uppercase mb-3">
            Built for the trades
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] tracking-tight">
            Every feature built to turn
            <br className="hidden sm:block" />
            <span className="text-[#475569]"> missed calls into money.</span>
          </h2>
        </AnimatedSection>

        {/* Card grid — desktop 2-col, mobile horizontal scroll-snap */}
        <AnimatedStagger
          className={[
            /* Mobile: horizontal scroll-snap */
            'flex gap-4 overflow-x-auto pb-4 -mx-6 px-6',
            '[scroll-snap-type:x_mandatory]',
            /* Desktop: 2-col grid */
            'md:grid md:grid-cols-2 md:overflow-visible md:pb-0 md:mx-0 md:px-0',
          ].join(' ')}
        >

          {/* ── Language hero card (full-width on desktop) ── */}
          <AnimatedItem className="min-w-[85vw] [scroll-snap-align:center] md:min-w-0 md:[scroll-snap-align:unset] md:col-span-2">
            <div className="h-full bg-white rounded-2xl border border-stone-200/60 p-6 md:p-8 shadow-sm hover:border-[#F97316]/30 hover:shadow-[0_4px_20px_rgba(249,115,22,0.1)] hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                {/* Left side */}
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center justify-center rounded-xl size-11 bg-[#F97316]/[0.08] border border-[#F97316]/[0.12] mb-4">
                    <Globe className="size-5 text-[#F97316]" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-2">70+ Languages. Zero Frustration.</h3>
                  <p className="text-base text-[#475569] leading-relaxed mb-3 max-w-md">
                    Your AI receptionist speaks their language — English, Spanish, Chinese, Malay, and 70+ more. It detects the caller&apos;s language instantly. No frustrated hang-ups. No lost leads.
                  </p>
                  <p className="text-xs text-[#64748B]">Powered by Gemini 3.1 Flash Live</p>
                </div>
                {/* Right side: animated language bubbles */}
                <div className="shrink-0 flex justify-center">
                  <LanguageHeroVisual />
                </div>
              </div>
            </div>
          </AnimatedItem>

          {/* ── 6 feature cards ── */}
          {FEATURES.map((feat) => (
            <AnimatedItem
              key={feat.title}
              className="min-w-[85vw] [scroll-snap-align:center] md:min-w-0 md:[scroll-snap-align:unset]"
            >
              <div className="h-full bg-white rounded-2xl border border-stone-200/60 p-6 md:p-8 shadow-sm hover:border-[#F97316]/30 hover:shadow-[0_4px_20px_rgba(249,115,22,0.1)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
                <div className="inline-flex items-center justify-center rounded-xl size-11 bg-[#F97316]/[0.08] border border-[#F97316]/[0.12] mb-4">
                  <feat.icon className="size-5 text-[#F97316]" strokeWidth={1.75} />
                </div>
                <h3 className="text-sm font-semibold text-[#0F172A] mb-1">{feat.title}</h3>
                <p className="text-base text-[#475569] leading-relaxed mb-4">{feat.description}</p>
                <div className="flex-1 flex items-center justify-center">
                  <feat.Visual />
                </div>
                {feat.microValue && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-100">
                    <div className="size-1.5 rounded-full bg-[#166534] shrink-0" />
                    <p className="text-sm font-medium text-[#166534]">{feat.microValue}</p>
                  </div>
                )}
              </div>
            </AnimatedItem>
          ))}

        </AnimatedStagger>
      </div>
    </section>
  );
}
