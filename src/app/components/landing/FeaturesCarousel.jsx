'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Globe,
  PhoneIncoming,
  CalendarCheck,
  MessageSquare,
  BarChart3,
  UserCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

/* ─────────────────────────────────────────
   Micro Visual: 70+ Languages
───────────────────────────────────────── */
function LanguageHeroVisual({ isActive }) {
  const bubbles = [
    { label: 'EN',  x: '10%', y: '15%', delay: '0s',   size: 40, accent: false },
    { label: 'ES',  x: '55%', y: '5%',  delay: '0.5s', size: 40, accent: false },
    { label: 'ZH',  x: '75%', y: '45%', delay: '1s',   size: 36, accent: false },
    { label: 'MS',  x: '20%', y: '60%', delay: '1.5s', size: 36, accent: false },
    { label: '70+', x: '48%', y: '52%', delay: '2s',   size: 48, accent: true  },
  ];

  return (
    <div className="relative w-48 h-36 md:w-56 md:h-40 mx-auto shrink-0" aria-hidden="true">
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
   Micro Visual: 24/7 AI Answering
───────────────────────────────────────── */
function AnsweringVisual({ isActive }) {
  return (
    <div className="relative mx-auto w-32 h-36" aria-hidden="true">
      <svg viewBox="0 0 128 128" className="w-32 h-32" aria-hidden="true">
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
function SMSVisual({ isActive }) {
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
function AnalyticsVisual({ isActive }) {
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
              style={{
                height: `${bar.height}%`,
                animation: `barGrow 1s ease-out ${i * 0.1}s both`,
                animationPlayState: isActive ? 'running' : 'paused',
              }}
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
function LeadVisual({ isActive }) {
  return (
    <div
      className="w-full rounded-xl bg-stone-50 border border-stone-100 px-3 py-3 space-y-2"
      aria-hidden="true"
    >
      {[
        { label: 'Caller',   value: 'James Rivera' },
        { label: 'Address',  value: '42 Oak St, Austin TX' },
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
function CalSyncVisual({ isActive }) {
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
   Feature data array
───────────────────────────────────────── */
const FEATURES = [
  {
    icon: Globe,
    title: '70+ Languages',
    navLabel: 'Languages',
    description: 'Your AI receptionist detects the caller\'s language instantly — English, Spanish, Chinese, Malay, and 70+ more. No frustrated hang-ups. No lost leads.',
    Visual: LanguageHeroVisual,
  },
  {
    icon: PhoneIncoming,
    title: '24/7 AI Answering',
    navLabel: 'Always On',
    description: 'Picks up in under a second at 2 AM on a Sunday or mid-job-site. Zero voicemail. Zero missed leads.',
    Visual: AnsweringVisual,
  },
  {
    icon: CalendarCheck,
    title: 'Real-Time Calendar Booking',
    navLabel: 'Booking',
    description: 'Emergency jobs get locked into your calendar while the caller is still on the line. No follow-up, no back-and-forth — job confirmed.',
    Visual: BookingVisual,
  },
  {
    icon: MessageSquare,
    title: 'Post-Call SMS & Notifications',
    navLabel: 'Notifications',
    description: 'You get a text in seconds with caller details, urgency level, and job type — so you can dispatch before competitors even call back.',
    Visual: SMSVisual,
  },
  {
    icon: BarChart3,
    title: 'Call Analytics & Dashboard',
    navLabel: 'Analytics',
    description: 'See every call, lead, and booking in one place. Know which calls converted, which slipped away, and your busiest hours.',
    Visual: AnalyticsVisual,
  },
  {
    icon: UserCheck,
    title: 'Lead Capture & CRM',
    navLabel: 'CRM',
    description: 'Every caller becomes a structured lead — name, address, job type, urgency — automatically logged. No manual data entry ever again.',
    Visual: LeadVisual,
  },
  {
    icon: RefreshCw,
    title: 'Google & Outlook Calendar Sync',
    navLabel: 'Calendar',
    description: 'Two-way sync keeps your existing Google or Outlook calendar in perfect sync. Book via Voco and it shows up everywhere, instantly.',
    Visual: CalSyncVisual,
  },
];

/* ─────────────────────────────────────────
   Main export
───────────────────────────────────────── */
export function FeaturesCarousel() {
  const trackRef = useRef(null);
  const intervalRef = useRef(null);
  const userInteractedRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  /* ── Scroll a specific card index into the track (no page scroll) ── */
  const scrollToIndex = useCallback((idx) => {
    const clamped = ((idx % FEATURES.length) + FEATURES.length) % FEATURES.length;
    const track = trackRef.current;
    const card = track?.children?.[clamped];
    if (!track || !card) return;
    // Block observer from overriding during programmatic scroll
    isProgrammaticScrollRef.current = true;
    const cardLeft = card.offsetLeft;
    const cardWidth = card.offsetWidth;
    const trackWidth = track.offsetWidth;
    const scrollTarget = cardLeft - (trackWidth / 2) + (cardWidth / 2);
    track.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    setActiveIndex(clamped);
    // Re-enable observer after scroll settles
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 800);
  }, []);

  /* ── Stop auto-advance permanently on any user interaction ── */
  const stopAutoAdvance = useCallback(() => {
    userInteractedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /* ── Auto-advance on mount (stops permanently on user interaction) ── */
  useEffect(() => {
    if (prefersReducedMotion) return;

    intervalRef.current = setInterval(() => {
      isAutoScrollingRef.current = true;
      setActiveIndex((prev) => {
        const next = (prev + 1) % FEATURES.length;
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
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [prefersReducedMotion]);

  /* ── IntersectionObserver: sync activeIndex on swipe ── */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Skip observer updates during programmatic or auto scrolls
        if (isProgrammaticScrollRef.current || isAutoScrollingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = Array.from(track.children);
            const idx = cards.indexOf(entry.target);
            if (idx !== -1) {
              setActiveIndex(idx);
            }
          }
        });
      },
      { root: track, threshold: 0.5 }
    );

    Array.from(track.children).forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="bg-[#FAFAF9] py-20 md:py-28 px-6 overflow-hidden">
      {/* Section heading */}
      <AnimatedSection className="max-w-2xl mx-auto text-center mb-16">
        <p className="text-xs md:text-sm font-semibold tracking-[0.15em] uppercase text-[#F97316] mb-3">
          Built for the trades
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.2] text-[#0F172A]">
          Every call handled. Every job captured.
        </h2>
      </AnimatedSection>

      {/* Carousel region */}
      <div
        role="region"
        aria-label="Features"
        className="relative max-w-[100vw]"
      >
        {/* Left arrow */}
        <button
          aria-label="Previous feature"
          onClick={() => { stopAutoAdvance(); scrollToIndex(activeIndex - 1); }}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full items-center justify-center bg-white border border-stone-200 text-[#0F172A] shadow-sm hover:bg-[#F97316] hover:text-white hover:border-[#F97316] hover:shadow-md active:scale-[0.96] transition-colors duration-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right arrow */}
        <button
          aria-label="Next feature"
          onClick={() => { stopAutoAdvance(); scrollToIndex(activeIndex + 1); }}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full items-center justify-center bg-white border border-stone-200 text-[#0F172A] shadow-sm hover:bg-[#F97316] hover:text-white hover:border-[#F97316] hover:shadow-md active:scale-[0.96] transition-colors duration-200"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Carousel track — masked fade on desktop edges */}
        <div className="carousel-track-mask">
        <div
          ref={trackRef}
          onScroll={() => { if (!isAutoScrollingRef.current) stopAutoAdvance(); }}
          className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide px-[calc(50%-140px)] md:px-[calc(50%-180px)] lg:px-[calc(50%-210px)]"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            touchAction: 'pan-x',
          }}
        >
          {FEATURES.map((feat, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={feat.title}
                className="flex-shrink-0 w-[280px] md:w-[360px] lg:w-[420px]"
                style={{ scrollSnapAlign: 'center' }}
              >
                <div
                  className={`bg-white rounded-2xl border border-stone-200/60 p-6 md:p-8 shadow-sm flex flex-col transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive
                      ? 'scale-[1.04] opacity-100 border-t-2 border-t-[#F97316]'
                      : 'scale-100 opacity-70'
                  }`}
                >
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-[#F97316]/[0.08] border border-[#F97316]/[0.12] flex items-center justify-center">
                    <feat.icon className="w-5 h-5 text-[#F97316]" strokeWidth={1.75} />
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-[#0F172A] mt-3">{feat.title}</h3>

                  {/* Description */}
                  <p className="text-base text-[#475569] leading-relaxed mt-2">{feat.description}</p>

                  {/* Micro visual */}
                  <div className="mt-4 flex-1 flex items-center justify-center min-h-[140px]">
                    <feat.Visual isActive={isActive} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* Icon nav grid */}
        <div className="mt-8 flex overflow-x-auto scrollbar-hide gap-1 px-4 md:overflow-x-visible md:justify-center md:px-0">
          {FEATURES.map((feat, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={feat.navLabel}
                aria-label={`Go to feature: ${feat.title}`}
                onClick={() => { stopAutoAdvance(); scrollToIndex(i); }}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 min-w-[60px] min-h-[44px] transition-opacity duration-200 rounded-lg ${
                  isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                }`}
              >
                <feat.icon
                  className={`w-5 h-5 ${isActive ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}
                  strokeWidth={1.75}
                />
                <span
                  className={`text-[11px] md:text-xs font-semibold ${isActive ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}
                >
                  {feat.navLabel}
                </span>
                <span
                  className={`w-1 h-1 rounded-full bg-[#F97316] transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </button>
            );
          })}
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
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          }
        }
      `}</style>
    </section>
  );
}
