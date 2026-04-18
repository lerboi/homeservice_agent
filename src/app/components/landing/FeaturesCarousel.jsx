'use client';
import { useEffect, useRef, useState } from 'react';
import {
  PhoneIncoming,
  CalendarCheck,
  MessageSquare,
  PhoneMissed,
  Wrench,
  Zap,
  Thermometer,
  Check,
} from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

/* ─────────────────────────────────────────
   Micro Visual: 24/7 AI Answering
───────────────────────────────────────── */
function AnsweringVisual({ active }) {
  return (
    <div className="relative w-full max-w-[420px] mx-auto aspect-square">
      <div
        aria-hidden="true"
        className="absolute inset-[12%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(249,115,22,0.22), transparent 70%)',
          filter: 'blur(30px)',
        }}
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        <circle cx="100" cy="100" r="84" fill="none" stroke="#F5F5F4" strokeWidth="1.5" />
        <circle
          cx="100" cy="100" r="84" fill="none" stroke="#F97316"
          strokeOpacity="0.7" strokeWidth="3.5" strokeDasharray="528"
          strokeDashoffset={active ? 0 : 528}
          strokeLinecap="round" transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 1.4s ease-out' }}
        />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((d) => (
          <line
            key={d} x1="100" y1="22" x2="100" y2="32"
            stroke="#D6D3D1" strokeWidth="2" strokeLinecap="round"
            transform={`rotate(${d} 100 100)`}
          />
        ))}
        <g style={{ transformOrigin: '100px 100px', animation: active ? 'fc-spin-hr 32s linear infinite' : 'none' }}>
          <line x1="100" y1="100" x2="100" y2="52" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <g style={{ transformOrigin: '100px 100px', animation: active ? 'fc-spin-min 8s linear infinite' : 'none' }}>
          <line x1="100" y1="100" x2="100" y2="32" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="5" fill="#F97316" />
      </svg>
      <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#F97316]/10 border border-[#F97316]/25 whitespace-nowrap text-[12px] font-semibold text-[#F97316] tracking-[0.06em]">
        24/7 ACTIVE
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Real-Time Calendar Booking
───────────────────────────────────────── */
function BookingVisual({ active }) {
  const days = Array.from({ length: 21 }, (_, i) => i + 1);
  const booked = [4, 8, 12];
  const locked = [14];
  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      <div
        className="bg-white border border-stone-200 rounded-[20px] p-6"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,42,0.15)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="text-[14px] font-semibold text-[#0F172A]">March 2026</div>
          <div className="flex gap-2 text-[#94A3B8]">
            <span className="w-6 h-6 rounded-md bg-stone-100 inline-flex items-center justify-center text-[14px]">‹</span>
            <span className="w-6 h-6 rounded-md bg-stone-100 inline-flex items-center justify-center text-[14px]">›</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-[#94A3B8] font-medium mb-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const isBooked = booked.includes(d);
            const isLocked = locked.includes(d);
            return (
              <div
                key={d}
                className={`aspect-square rounded-lg flex items-center justify-center text-[13px] font-medium ${
                  isBooked
                    ? 'bg-[#F97316] text-white'
                    : isLocked
                    ? 'bg-[#F97316]/15 text-[#F97316] border-2 border-dashed border-[#F97316]/45'
                    : 'bg-stone-50 text-[#475569] border border-stone-100'
                }`}
                style={{
                  boxShadow: isBooked ? '0 2px 12px rgba(249,115,22,0.35)' : 'none',
                  animation: active && isLocked ? 'fc-pulse-day 1.6s ease-in-out infinite' : 'none',
                }}
              >{d}</div>
            );
          })}
        </div>
        <div
          className="mt-4 px-3 py-2.5 rounded-[10px] bg-[#F97316]/[0.08] border border-[#F97316]/20 flex items-center gap-2.5"
        >
          <span className="w-7 h-7 rounded-full bg-[#F97316] inline-flex items-center justify-center text-white shrink-0">
            <Check className="w-3.5 h-3.5" />
          </span>
          <div className="text-[13px] leading-[1.3]">
            <div className="font-semibold text-[#0F172A]">Booked Thu 14, 9:00 AM</div>
            <div className="text-[#475569] text-[12px]">HVAC checkup · 30min buffer</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Speaks Your Trade
───────────────────────────────────────── */
function TradeVisual({ active }) {
  const langs = ['Hello — HVAC tech?', '¿Mi calefacción no funciona?', '请问能安排师傅吗?', 'Aircon tak sejuk la'];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setI((p) => (p + 1) % langs.length), 2200);
    return () => clearInterval(t);
  }, [active]);
  return (
    <div className="relative w-full max-w-[420px] mx-auto">
      <div className="flex gap-3 justify-center mb-6">
        {[{ I: Wrench, l: 'Plumbing' }, { I: Zap, l: 'Electrical' }, { I: Thermometer, l: 'HVAC' }].map(({ I, l }, idx) => (
          <div
            key={l}
            className="px-4 py-3 bg-white border border-stone-200 rounded-[14px] flex items-center gap-2.5"
            style={{
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              animation: active ? `fc-floaty 3s ease-in-out ${idx * 0.3}s infinite` : 'none',
            }}
          >
            <span className="text-[#F97316]"><I className="w-4.5 h-4.5" /></span>
            <span className="text-[13px] font-semibold text-[#0F172A]">{l}</span>
          </div>
        ))}
      </div>
      <div
        className="bg-white border border-stone-200 rounded-[18px] px-6 py-5 text-center"
        style={{ boxShadow: '0 20px 40px -15px rgba(15,23,42,0.12)' }}
      >
        <div className="text-[11px] font-semibold text-[#94A3B8] tracking-[0.15em] uppercase mb-2.5">
          Live · caller said
        </div>
        <div className="text-[17px] font-medium text-[#0F172A] min-h-[46px] flex items-center justify-center">
          <span key={i} style={{ animation: 'fc-fade-slide 0.4s ease-out' }}>{langs[i]}</span>
        </div>
        <div className="mt-3.5 text-[12px] text-[#475569]">
          Voco responds fluently in <b className="text-[#0F172A]">70+ languages</b> · auto-detected
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Micro Visual: Automated Lead Recovery
───────────────────────────────────────── */
function RecoveryVisual({ active }) {
  return (
    <div
      key={active ? 'on' : 'off'}
      className="w-full max-w-[360px] mx-auto flex flex-col gap-3"
    >
      <div
        className="bg-white border border-stone-200 rounded-[14px] px-4 py-3.5 flex items-start gap-3"
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          animation: active ? 'fc-slide-in-l 0.5s ease-out both' : 'none',
        }}
      >
        <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 inline-flex items-center justify-center shrink-0">
          <PhoneMissed className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#0F172A]">Missed call</div>
          <div className="text-[12px] text-[#475569]">(415) 555-0142 · no voicemail</div>
        </div>
        <div className="text-[11px] text-[#94A3B8] whitespace-nowrap">2m ago</div>
      </div>
      <div className="flex justify-center text-[#94A3B8] text-[16px]">↓</div>
      <div
        className="bg-[#FFF7ED] border border-[#F97316]/25 rounded-[14px] px-4 py-3.5 flex items-start gap-3"
        style={{ animation: active ? 'fc-slide-in-l 0.6s 0.2s ease-out both' : 'none' }}
      >
        <span className="w-8 h-8 rounded-lg bg-[#F97316]/15 text-[#F97316] inline-flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4" />
        </span>
        <div>
          <div className="text-[13px] font-semibold text-[#0F172A]">Voco sent an SMS</div>
          <div className="text-[12px] text-[#475569] italic mt-0.5">
            &ldquo;Hey, sorry we missed you — want to book?&rdquo;
          </div>
        </div>
      </div>
      <div className="flex justify-center text-[#94A3B8] text-[16px]">↓</div>
      <div
        className="bg-green-50 border border-green-200 rounded-[14px] px-4 py-3.5 flex items-start gap-3"
        style={{ animation: active ? 'fc-slide-in-l 0.7s 0.4s ease-out both' : 'none' }}
      >
        <span className="w-8 h-8 rounded-lg bg-green-500 text-white inline-flex items-center justify-center shrink-0">
          <Check className="w-4 h-4" />
        </span>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-[#0F172A]">Lead recovered</div>
          <div className="text-[12px] text-[#475569]">Booked for Thursday 9am</div>
        </div>
        <span className="text-[11px] font-semibold text-green-800 bg-green-800/10 px-2 py-0.5 rounded-full">
          $620
        </span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    id: '24-7-answering',
    Icon: PhoneIncoming,
    navLabel: 'Always on',
    title: '24/7 AI Answering',
    tagline: 'Picks up in under a second — 2 AM Sunday or mid-job-site.',
    description:
      'Every inbound call answered in under 1 ring — day, night, weekends, holidays. No voicemail, no lost leads.',
    Visual: AnsweringVisual,
  },
  {
    id: 'real-time-booking',
    Icon: CalendarCheck,
    navLabel: 'Books on the line',
    title: 'Real-Time Calendar Booking',
    tagline: "Books the job while they're still on the line.",
    description:
      'Voco reads your Google or Outlook calendar live and books the caller into a confirmed slot before they hang up. Travel buffers included.',
    Visual: BookingVisual,
  },
  {
    id: 'speaks-your-trade',
    Icon: Wrench,
    navLabel: 'Speaks your trade',
    title: 'Speaks Your Trade',
    tagline: 'Knows the vocabulary — and speaks the language.',
    description:
      'Plumbing, HVAC, electrical, handyman — Voco knows the vocabulary. Also fluent in English, Spanish, Mandarin, Malay, and 70+ more, including Singlish and mid-call code-switching.',
    Visual: TradeVisual,
  },
  {
    id: 'lead-recovery',
    Icon: PhoneMissed,
    navLabel: 'Recovers misses',
    title: 'Automated Lead Recovery',
    tagline: 'Missed calls become SMS conversations that convert.',
    description:
      'If a caller hangs up before booking, Voco sends an SMS with available slots. You wake up to booked jobs, not missed opportunities.',
    Visual: RecoveryVisual,
  },
];

export function FeaturesCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const itemRefs = useRef([]);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const els = itemRefs.current.filter(Boolean);
      if (!els.length) return;
      const mid = window.innerHeight / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      const centers = els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      centers.forEach((c, i) => {
        const d = Math.abs(c - mid);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      setActiveIdx(bestIdx);
      const first = centers[0];
      const last = centers[centers.length - 1];
      const span = last - first || 1;
      const p = Math.max(0, Math.min(1, (mid - first) / span));
      setProgress(p);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const active = FEATURES[activeIdx];
  const ActiveVisual = active.Visual;

  return (
    <section id="features" className="bg-white py-32 px-6">
      <AnimatedSection className="max-w-[780px] mx-auto text-center mb-20">
        <div className="inline-block text-[13px] font-semibold text-[#F97316] tracking-[0.18em] uppercase">
          How it works for you
        </div>
        <h2
          className="font-semibold text-[#0F172A] mt-3.5"
          style={{
            fontSize: 'clamp(32px, 4vw, 52px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Four ways Voco earns its keep.
        </h2>
        <p className="text-[18px] text-[#475569] mt-5 leading-[1.6]">
          Scroll the roadmap — from first ring to booked job.
        </p>
      </AnimatedSection>

      <div className="fc-grid relative max-w-[1040px] mx-auto grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] md:gap-16 gap-12 items-start">
        {/* LEFT — sticky visual stage (desktop only) */}
        <div className="fc-stage-wrap hidden md:block relative">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#F97316]/[0.08] border border-[#F97316]/20 text-[#F97316] text-[11px] font-semibold tracking-[0.14em] uppercase mb-4">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#F97316]"
              style={{ boxShadow: '0 0 0 4px rgba(249,115,22,0.2)' }}
            />
            Phase 0{activeIdx + 1} · {active.navLabel}
          </div>

          <div
            className="fc-stage relative flex items-center justify-center border border-stone-200 rounded-3xl p-8 overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #FAFAF9, #fff)',
              height: 'min(66vh, 520px)',
            }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 70% 60% at 30% 20%, rgba(249,115,22,0.06), transparent 60%)',
              }}
            />
            <div
              key={active.id}
              className="w-full h-full flex items-center justify-center"
              style={{ animation: 'fc-fade-in 0.45s ease-out' }}
            >
              <ActiveVisual active={true} />
            </div>
          </div>

          <div className="fc-step-count hidden md:flex items-center gap-2.5 mt-5 text-[13px] text-[#94A3B8] font-medium">
            <span className="text-[#0F172A] font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              0{activeIdx + 1}
            </span>
            <span className="w-10 h-px bg-stone-200" />
            <span>of 0{FEATURES.length}</span>
          </div>
        </div>

        {/* RIGHT — roadmap rail */}
        <div className="fc-rail relative">
          <div
            aria-hidden="true"
            className="absolute left-[19px] top-3.5 bottom-3.5 w-0.5 bg-stone-200 rounded-sm"
          />
          <div
            aria-hidden="true"
            className="absolute left-[19px] top-3.5 w-0.5 bg-[#F97316] rounded-sm"
            style={{
              height: `calc((100% - 28px) * ${progress})`,
              transition: 'height 120ms linear',
              boxShadow: '0 0 12px rgba(249,115,22,0.4)',
            }}
          />

          <div className="flex flex-col gap-10 md:gap-[180px]">
            {FEATURES.map((f, i) => {
              const isActive = i === activeIdx;
              const passed = i < activeIdx;
              const reached = isActive || passed;
              const ItemVisual = f.Visual;
              return (
                <article
                  key={f.id}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  className="relative pl-14 md:pl-16 pr-1 py-1.5 cursor-pointer"
                  onClick={() =>
                    itemRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                >
                  <div
                    aria-hidden="true"
                    className="absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold z-10 transition-all duration-300"
                    style={{
                      background: reached ? '#F97316' : '#fff',
                      color: reached ? '#fff' : '#94A3B8',
                      border: `2px solid ${reached ? '#F97316' : '#E7E5E4'}`,
                      boxShadow: isActive ? '0 0 0 6px rgba(249,115,22,0.12)' : 'none',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  <div
                    className="px-5 py-4 rounded-2xl transition-all duration-[350ms]"
                    style={{
                      background: isActive ? '#fff' : 'transparent',
                      border: `1px solid ${isActive ? '#E7E5E4' : 'transparent'}`,
                      boxShadow: isActive ? '0 16px 40px -20px rgba(15,23,42,0.18)' : 'none',
                      opacity: isActive ? 1 : passed ? 0.55 : 0.85,
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <span
                        className="w-[30px] h-[30px] rounded-lg inline-flex items-center justify-center transition-all duration-300"
                        style={{
                          background: isActive ? 'rgba(249,115,22,0.1)' : '#FAFAF9',
                          border: `1px solid ${isActive ? 'rgba(249,115,22,0.2)' : '#E7E5E4'}`,
                          color: isActive ? '#F97316' : '#94A3B8',
                        }}
                      >
                        <f.Icon className="w-4 h-4" strokeWidth={1.75} />
                      </span>
                      <span
                        className="text-[10.5px] font-semibold tracking-[0.14em] uppercase transition-colors duration-300"
                        style={{ color: isActive ? '#F97316' : '#94A3B8' }}
                      >
                        {f.navLabel}
                      </span>
                    </div>
                    <h3
                      className="text-[22px] font-semibold text-[#0F172A] m-0 mb-2"
                      style={{ letterSpacing: '-0.01em', lineHeight: 1.2 }}
                    >
                      {f.title}
                    </h3>
                    <p className="text-[16px] font-medium leading-[1.45] text-[#0F172A] m-0 mb-2">
                      {f.tagline}
                    </p>
                    <p className="text-[14.5px] leading-[1.6] text-[#475569] m-0">
                      {f.description}
                    </p>

                    {/* Mobile-only inline visual — desktop version lives in the sticky stage */}
                    <div
                      className="md:hidden mt-5 p-5 rounded-xl border border-stone-200 bg-gradient-to-b from-[#FAFAF9] to-white flex items-center justify-center"
                      style={{ minHeight: 280 }}
                    >
                      <ItemVisual active={isActive} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .fc-stage-wrap { position: relative; }
        @media (min-width: 960px) {
          .fc-stage-wrap {
            position: sticky;
            top: 120px;
            align-self: start;
          }
          .fc-stage { height: min(72vh, 600px) !important; }
        }
        @keyframes fc-spin-hr { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes fc-spin-min { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes fc-pulse-day { 0%,100%{ border-color: rgba(249,115,22,0.45);} 50%{ border-color: rgba(249,115,22,0.9);} }
        @keyframes fc-floaty { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-4px);} }
        @keyframes fc-fade-slide { from { opacity:0; transform: translateY(6px);} to { opacity:1; transform: translateY(0);} }
        @keyframes fc-slide-in-l { from { opacity:0; transform: translateX(-12px);} to { opacity:1; transform: translateX(0);} }
      `}</style>
    </section>
  );
}
