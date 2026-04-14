'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Globe,
  PhoneIncoming,
  PhoneForwarded,
  CalendarCheck,
  MessageSquare,
  BarChart3,
  UserCheck,
  PhoneMissed,
  Receipt,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

/* ─────────────────────────────────────────
   Micro Visual: 24/7 AI Answering
───────────────────────────────────────── */
function AnsweringVisual({ isActive }) {
  return (
    <div className="relative mx-auto w-40 h-44" aria-hidden="true">
      <svg viewBox="0 0 128 128" className="w-40 h-40" aria-hidden="true">
        <circle cx="64" cy="64" r="54" fill="none" stroke="currentColor" className="text-stone-100" strokeWidth="1" />
        <circle
          cx="64" cy="64" r="54" fill="none" stroke="currentColor"
          className="text-[#F97316]/50"
          strokeWidth="3" strokeDasharray="339" strokeDashoffset="339"
          strokeLinecap="round" transform="rotate(-90 64 64)"
          style={{ animation: 'clockSpin 8s linear infinite', animationPlayState: isActive ? 'running' : 'paused' }}
        />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <line
            key={deg} x1="64" y1="12" x2="64" y2="18"
            stroke="currentColor" className="text-stone-300"
            strokeWidth="1.5" strokeLinecap="round"
            transform={`rotate(${deg} 64 64)`}
          />
        ))}
        <circle cx="64" cy="64" r="3.5" fill="currentColor" className="text-[#F97316]" />
        <line x1="64" y1="64" x2="64" y2="30" stroke="currentColor" className="text-[#0F172A]" strokeWidth="2.5" strokeLinecap="round" transform="rotate(30 64 64)" />
        <line x1="64" y1="64" x2="64" y2="22" stroke="currentColor" className="text-stone-400" strokeWidth="1.5" strokeLinecap="round" transform="rotate(180 64 64)" />
      </svg>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#F97316]/10 border border-[#F97316]/20 whitespace-nowrap">
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
   Micro Visual: Custom Pickup Rules
───────────────────────────────────────── */
function PickupRulesVisual({ isActive }) {
  return (
    <div className="w-full max-w-[280px] mx-auto space-y-2.5" aria-hidden="true">
      {/* Schedule card */}
      <div className="rounded-xl bg-stone-50 border border-stone-200/60 px-3 py-2.5">
        <p className="text-[10px] font-semibold tracking-wide uppercase text-stone-400 mb-1.5">Schedule</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[#0F172A] font-medium">Mon&ndash;Fri 9am&ndash;6pm</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Rings you
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className="text-[11px] text-[#0F172A] font-medium">After hours</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/30">
            AI answers
          </span>
        </div>
      </div>

      {/* Ring delay card */}
      <div className="rounded-xl bg-stone-50 border border-stone-200/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] font-semibold tracking-wide uppercase text-stone-400">Ring delay</span>
          <span className="text-[11px] text-[#0F172A] font-semibold tabular-nums">15s</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-stone-200 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[60%] rounded-full bg-[#F97316]" />
        </div>
      </div>

      {/* VIP card */}
      <div className="rounded-xl bg-stone-50 border border-stone-200/60 px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Star className="w-3.5 h-3.5 text-[#F97316] fill-[#F97316]" aria-hidden="true" />
          <span className="text-[10px] font-semibold tracking-wide uppercase text-stone-400">VIP callers bypass AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-[#0F172A] px-2 py-0.5 rounded bg-white border border-stone-200">
            (415) &bull;&bull;&bull;&bull;
          </span>
          <span className="text-[10px] font-medium text-[#0F172A] px-2 py-0.5 rounded bg-white border border-stone-200">
            (650) &bull;&bull;&bull;&bull;
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: 70+ Languages
───────────────────────────────────────── */
function LanguageVisual({ isActive }) {
  const bubbles = [
    { label: 'EN',  x: '5%',  y: '12%', delay: '0s',   size: 44, accent: false },
    { label: 'ES',  x: '60%', y: '6%',  delay: '0.5s', size: 44, accent: false },
    { label: 'ZH',  x: '78%', y: '48%', delay: '1s',   size: 40, accent: false },
    { label: 'MS',  x: '18%', y: '64%', delay: '1.5s', size: 40, accent: false },
    { label: 'TL',  x: '68%', y: '78%', delay: '2.5s', size: 36, accent: false },
    { label: '70+', x: '42%', y: '48%', delay: '2s',   size: 52, accent: true  },
  ];

  return (
    <div className="relative w-56 h-44 md:w-64 md:h-48 mx-auto shrink-0" aria-hidden="true">
      {bubbles.map((b) => (
        <div
          key={b.label}
          className={`absolute rounded-full flex items-center justify-center text-xs font-bold border-2 ${
            b.accent
              ? 'bg-[#F97316] text-white border-[#F97316] shadow-[0_0_16px_rgba(249,115,22,0.35)]'
              : 'bg-white text-[#475569] border-stone-200 shadow-sm'
          }`}
          style={{
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            animation: `langFloat 3s ease-in-out ${b.delay} infinite`,
            animationPlayState: isActive ? 'running' : 'paused',
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
   Micro Visual: Real-Time Calendar Booking
───────────────────────────────────────── */
function BookingVisual({ isActive }) {
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
    <div className="w-full max-w-[240px] mx-auto space-y-2" aria-hidden="true">
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
   Micro Visual: Lead Capture & CRM
───────────────────────────────────────── */
function LeadVisual({ isActive }) {
  return (
    <div
      className="w-full max-w-[260px] mx-auto rounded-xl bg-stone-50 border border-stone-200/60 px-4 py-4 space-y-2.5"
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
      <div className="pt-1.5 flex items-center justify-between border-t border-stone-200">
        <span className="text-[11px] text-stone-400 font-medium">Urgency</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
          EMERGENCY
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Automated Lead Recovery
───────────────────────────────────────── */
function LeadRecoveryVisual({ isActive }) {
  return (
    <div className="w-full max-w-[280px] mx-auto space-y-2" aria-hidden="true">
      <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 bg-red-50 border border-red-100">
        <PhoneMissed className="w-4 h-4 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[#0F172A]">Missed call · 2 min ago</p>
          <p className="text-[11px] text-[#64748B]">(415) 555-0142 · No voicemail</p>
        </div>
      </div>
      <div className="flex justify-center">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="none" aria-hidden="true">
          <path d="M6 1V15M6 15L1 10M6 15L11 10" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 bg-[#F97316]/[0.08] border border-[#F97316]/20">
        <MessageSquare className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" strokeWidth={2} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[#0F172A]">SMS auto-sent</p>
          <p className="text-[11px] text-[#64748B] italic">&ldquo;Sorry we missed you — want to book?&rdquo;</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 bg-green-50 border border-green-100">
        <span className="size-4 rounded-full bg-green-500 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
            <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[#0F172A]">Lead recovered</p>
          <p className="text-[11px] text-[#64748B]">Booked for Thursday 9am</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Post-Call SMS & Notifications
───────────────────────────────────────── */
function SMSVisual({ isActive }) {
  const messages = [
    { text: 'Booking confirmed: Thu 14th @ 9am', sub: 'Smith Plumbing — AC repair', accent: true },
    { text: 'New lead captured', sub: 'Maria Gomez · Burst pipe · URGENT', accent: false },
    { text: 'SMS sent to caller', sub: '2 min ago · Appointment details', accent: false },
  ];

  return (
    <div className="w-full max-w-[280px] mx-auto space-y-2" aria-hidden="true">
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
   Micro Visual: Invoicing & Estimates
───────────────────────────────────────── */
function InvoiceVisual({ isActive }) {
  const lines = [
    { label: 'Labour · 2 hrs',       value: '$180.00' },
    { label: 'Parts · Thermostat',   value: '$95.00'  },
    { label: 'Service call',         value: '$75.00'  },
  ];
  return (
    <div className="w-full max-w-[260px] mx-auto rounded-xl bg-white border border-stone-200/70 shadow-sm px-4 py-4" aria-hidden="true">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-[#F97316]/[0.08] border border-[#F97316]/20 flex items-center justify-center">
            <Receipt className="w-3.5 h-3.5 text-[#F97316]" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#0F172A] leading-tight">INV-2026-0142</p>
            <p className="text-[9px] text-stone-400 leading-tight">Apr 14, 2026</p>
          </div>
        </div>
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
          SENT
        </span>
      </div>
      <div className="py-2.5 space-y-1.5">
        {lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#475569] truncate">{l.label}</span>
            <span className="text-[11px] text-[#0F172A] font-medium tabular-nums">{l.value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2.5 border-t border-stone-100">
        <span className="text-[11px] font-semibold text-[#0F172A]">Total</span>
        <span className="text-[13px] font-semibold text-[#F97316] tabular-nums">$350.00</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Call Analytics & Dashboard
───────────────────────────────────────── */
function AnalyticsVisual({ isActive }) {
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
              style={{
                height: `${bar.height}%`,
                animation: `barGrow 1s ease-out ${i * 0.1}s both`,
                animationPlayState: isActive ? 'running' : 'paused',
              }}
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
   Feature data array
───────────────────────────────────────── */
const FEATURES = [
  {
    icon: PhoneIncoming,
    title: '24/7 AI Answering',
    navLabel: 'Always On',
    tagline: 'Picks up in under a second — 2 AM Sunday or mid-job-site.',
    description: 'No voicemail. No missed leads. Zero gaps between your last job and your next call.',
    Visual: AnsweringVisual,
  },
  {
    icon: PhoneForwarded,
    title: 'Custom Pickup Rules',
    navLabel: 'Rules',
    tagline: 'Your phone rings first. AI steps in only when you can\u2019t.',
    description: 'Set schedule windows, a ring delay before AI answers, or VIP numbers that always bypass the AI. Voco follows your rules.',
    Visual: PickupRulesVisual,
  },
  {
    icon: Globe,
    title: '70+ Languages',
    navLabel: 'Languages',
    tagline: 'Detects the caller\'s language instantly.',
    description: 'English, Spanish, Chinese, Malay, Tagalog — 70+ in total. No frustrated hang-ups. No lost leads to language barriers.',
    Visual: LanguageVisual,
  },
  {
    icon: CalendarCheck,
    title: 'Real-Time Calendar Booking',
    navLabel: 'Booking',
    tagline: 'Books the job while they\'re still on the line.',
    description: 'Reads your live availability in Google or Outlook, offers a real slot, and locks it in before the caller hangs up.',
    Visual: BookingVisual,
  },
  {
    icon: UserCheck,
    title: 'Lead Capture & CRM',
    navLabel: 'CRM',
    tagline: 'Every caller becomes a structured lead.',
    description: 'Name, address, job type, urgency — automatically logged. Searchable pipeline. No manual data entry ever again.',
    Visual: LeadVisual,
  },
  {
    icon: PhoneMissed,
    title: 'Automated Lead Recovery',
    navLabel: 'Recovery',
    tagline: 'Missed calls become SMS conversations that convert.',
    description: 'If a call slips past, Voco texts the caller back within seconds — and walks them into a booking without you lifting a finger.',
    Visual: LeadRecoveryVisual,
  },
  {
    icon: MessageSquare,
    title: 'Post-Call SMS & Notifications',
    navLabel: 'Notifications',
    tagline: 'You get the heads-up. They get a confirmation.',
    description: 'Instant SMS to you with caller + job details. Confirmation text to the customer. Nobody refreshes voicemail.',
    Visual: SMSVisual,
  },
  {
    icon: Receipt,
    title: 'Invoicing & Estimates',
    navLabel: 'Invoicing',
    tagline: 'Send invoices the moment the job is done.',
    description: 'Pre-filled line items, branded template, email or SMS delivery. Get paid before you leave the driveway.',
    Visual: InvoiceVisual,
  },
  {
    icon: BarChart3,
    title: 'Call Analytics & Dashboard',
    navLabel: 'Analytics',
    tagline: 'Know exactly what your phone earned this week.',
    description: 'Every call, lead, and booking in one place. Revenue, conversion, recovered-call metrics — refreshed the second the call ends.',
    Visual: AnalyticsVisual,
  },
];

/* ─────────────────────────────────────────
   Main export
───────────────────────────────────────── */
const TOTAL_SETS = 3;
const CARDS = [...FEATURES, ...FEATURES, ...FEATURES];
const MIDDLE_OFFSET = FEATURES.length;
const INITIAL_INDEX = MIDDLE_OFFSET + Math.floor(FEATURES.length / 2);
const AUTO_ADVANCE_MS = 6000;

export function FeaturesCarousel() {
  const trackRef = useRef(null);
  const intervalRef = useRef(null);
  const userInteractedRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const [activeDisplayIndex, setActiveDisplayIndex] = useState(INITIAL_INDEX);
  const prefersReducedMotion = useReducedMotion();

  const activeIndex = activeDisplayIndex % FEATURES.length;

  const scrollToDisplayIndex = useCallback((displayIdx) => {
    const track = trackRef.current;
    const card = track?.children?.[displayIdx];
    if (!track || !card) return;
    isProgrammaticScrollRef.current = true;
    const cardLeft = card.offsetLeft;
    const cardWidth = card.offsetWidth;
    const trackWidth = track.offsetWidth;
    const scrollTarget = cardLeft - (trackWidth / 2) + (cardWidth / 2);
    track.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    setActiveDisplayIndex(displayIdx);
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 800);
  }, []);

  const scrollToIndex = useCallback((realIdx) => {
    const clamped = ((realIdx % FEATURES.length) + FEATURES.length) % FEATURES.length;
    const displayIdx = MIDDLE_OFFSET + clamped;
    scrollToDisplayIndex(displayIdx);
  }, [scrollToDisplayIndex]);

  const stopAutoAdvance = useCallback(() => {
    userInteractedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const card = track?.children?.[INITIAL_INDEX];
    if (!track || !card) return;
    const cardLeft = card.offsetLeft;
    const cardWidth = card.offsetWidth;
    const trackWidth = track.offsetWidth;
    const scrollTarget = cardLeft - (trackWidth / 2) + (cardWidth / 2);
    track.scrollTo({ left: scrollTarget, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    intervalRef.current = setInterval(() => {
      isAutoScrollingRef.current = true;
      setActiveDisplayIndex((prev) => {
        const next = prev + 1;
        const track = trackRef.current;
        const card = track?.children?.[next];
        if (track && card) {
          const cardLeft = card.offsetLeft;
          const cardWidth = card.offsetWidth;
          const trackWidth = track.offsetWidth;
          const scrollTarget = cardLeft - (trackWidth / 2) + (cardWidth / 2);
          track.scrollTo({ left: scrollTarget, behavior: 'smooth' });
          setTimeout(() => { isAutoScrollingRef.current = false; }, 800);
        }
        return next;
      });
    }, AUTO_ADVANCE_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScrollRef.current || isAutoScrollingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = Array.from(track.children);
            const idx = cards.indexOf(entry.target);
            if (idx !== -1) {
              setActiveDisplayIndex(idx);
            }
          }
        });
      },
      { root: track, threshold: 0.5 }
    );

    Array.from(track.children).forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let resetTimeout;
    const handleScroll = () => {
      if (isProgrammaticScrollRef.current || isAutoScrollingRef.current) return;
      clearTimeout(resetTimeout);
      resetTimeout = setTimeout(() => {
        const displayIdx = activeDisplayIndex;
        if (displayIdx < FEATURES.length || displayIdx >= FEATURES.length * 2) {
          const realIdx = displayIdx % FEATURES.length;
          const targetIdx = MIDDLE_OFFSET + realIdx;
          const card = track.children?.[targetIdx];
          if (card) {
            isProgrammaticScrollRef.current = true;
            const cardLeft = card.offsetLeft;
            const cardWidth = card.offsetWidth;
            const trackWidth = track.offsetWidth;
            const scrollTarget = cardLeft - (trackWidth / 2) + (cardWidth / 2);
            track.scrollTo({ left: scrollTarget, behavior: 'instant' });
            setActiveDisplayIndex(targetIdx);
            requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; });
          }
        }
      }, 150);
    };

    track.addEventListener('scrollend', handleScroll, { passive: true });
    return () => {
      track.removeEventListener('scrollend', handleScroll);
      clearTimeout(resetTimeout);
    };
  }, [activeDisplayIndex]);

  return (
    <section id="features" className="bg-[#FAFAF9] py-24 md:py-32 px-6 overflow-hidden">
      {/* Section heading */}
      <AnimatedSection className="max-w-2xl mx-auto text-center mb-16">
        <p className="text-xs md:text-sm font-semibold tracking-[0.15em] uppercase text-[#F97316] mb-3">
          The full-stack workflow
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-[1.15] text-[#0F172A]">
          Everything your phone does &mdash; answered, booked, billed.
        </h2>
        <p className="text-base md:text-lg text-[#475569] mt-5 leading-relaxed">
          Eight features that run the inbound side of your business while you&rsquo;re on the job.
        </p>
      </AnimatedSection>

      {/* Carousel region */}
      <div
        role="region"
        aria-label="Features"
        className="relative max-w-[100vw] lg:max-w-[1200px] lg:mx-auto"
      >
        {/* Left arrow */}
        <button
          aria-label="Previous feature"
          onClick={() => { stopAutoAdvance(); scrollToDisplayIndex(activeDisplayIndex - 1); }}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full items-center justify-center bg-white border border-stone-200 text-[#0F172A] shadow-sm hover:bg-[#F97316] hover:text-white hover:border-[#F97316] hover:shadow-lg active:scale-[0.96] transition-all duration-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right arrow */}
        <button
          aria-label="Next feature"
          onClick={() => { stopAutoAdvance(); scrollToDisplayIndex(activeDisplayIndex + 1); }}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full items-center justify-center bg-white border border-stone-200 text-[#0F172A] shadow-sm hover:bg-[#F97316] hover:text-white hover:border-[#F97316] hover:shadow-lg active:scale-[0.96] transition-all duration-200"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Carousel track — desktop edges fade out */}
        <div className="carousel-track-mask">
          <div
            ref={trackRef}
            onScroll={() => { if (!isAutoScrollingRef.current) stopAutoAdvance(); }}
            className="flex gap-5 md:gap-7 overflow-x-auto scrollbar-hide py-6 px-[calc(50%-160px)] md:px-[calc(50%-220px)] lg:px-[calc(50%-260px)]"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              touchAction: 'pan-x',
            }}
          >
            {CARDS.map((feat, displayIndex) => {
              const isActive = displayIndex === activeDisplayIndex;
              return (
                <div
                  key={`${feat.title}-${displayIndex}`}
                  className="flex-shrink-0 w-[320px] md:w-[440px] lg:w-[520px]"
                  style={{ scrollSnapAlign: 'center' }}
                >
                  <div
                    className={`relative bg-white rounded-3xl border border-stone-200/70 p-7 md:p-10 shadow-sm flex flex-col min-h-[520px] md:min-h-[560px] transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isActive
                        ? 'scale-[1.02] opacity-100 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] border-stone-200'
                        : 'scale-[0.97] opacity-55'
                    }`}
                  >
                    {/* Top accent line — only on active card */}
                    {isActive && (
                      <div className="absolute top-0 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-[#F97316] to-transparent rounded-full" />
                    )}

                    {/* Icon + eyebrow */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-xl bg-[#F97316]/[0.08] border border-[#F97316]/[0.15] flex items-center justify-center">
                        <feat.icon className="w-5 h-5 text-[#F97316]" strokeWidth={1.75} />
                      </div>
                      <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#F97316]">
                        {feat.navLabel}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl md:text-2xl font-semibold text-[#0F172A] leading-[1.2] tracking-tight">
                      {feat.title}
                    </h3>

                    {/* Tagline — punchy one-liner */}
                    <p className="text-base md:text-[17px] font-medium text-[#0F172A]/90 leading-snug mt-3">
                      {feat.tagline}
                    </p>

                    {/* Description */}
                    <p className="text-sm md:text-[15px] text-[#475569] leading-relaxed mt-3">
                      {feat.description}
                    </p>

                    {/* Micro visual */}
                    <div className="mt-auto pt-8 flex-1 flex items-end justify-center min-h-[200px]">
                      <feat.Visual isActive={isActive} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar + icon nav */}
        <div className="mt-10 max-w-[640px] mx-auto px-6">
          {/* Progress bar */}
          <div className="relative h-[2px] bg-stone-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-[#F97316] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((activeIndex + 1) / FEATURES.length) * 100}%` }}
            />
          </div>

          {/* Icon nav grid */}
          <div className="mt-5 flex overflow-x-auto scrollbar-hide gap-1 md:overflow-x-visible md:justify-between md:px-0">
            {FEATURES.map((feat, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={feat.navLabel}
                  aria-label={`Go to feature: ${feat.title}`}
                  onClick={() => { stopAutoAdvance(); scrollToIndex(i); }}
                  className={`flex flex-col items-center gap-1.5 px-2.5 py-2 min-w-[60px] min-h-[44px] transition-opacity duration-200 rounded-lg ${
                    isActive ? 'opacity-100' : 'opacity-35 hover:opacity-75'
                  }`}
                >
                  <feat.icon
                    className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'text-[#F97316]' : 'text-[#94A3B8]'}`}
                    strokeWidth={1.75}
                  />
                  <span
                    className={`text-[10px] md:text-[11px] font-semibold tracking-wide ${isActive ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}
                  >
                    {feat.navLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollbar hiding utility */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @media (min-width: 768px) {
          .carousel-track-mask {
            mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent);
          }
        }
      `}</style>
    </section>
  );
}
