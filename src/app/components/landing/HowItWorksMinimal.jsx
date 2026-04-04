'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Phone, Brain, CalendarCheck, LayoutDashboard } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    Icon: Phone,
    title: 'Every Call Answered',
    subtitle: 'Before the second ring.',
    description:
      'A homeowner calls about a burst pipe at 11 PM. Voco picks up instantly — sounds human, speaks their language, and never puts them on hold.',
    visualType: 'icon',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    ringColor: 'ring-amber-200/30',
    numberColor: 'text-amber-400/[0.06]',
    shapeFill: 'bg-amber-400/[0.04]',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200/60',
    badgeText: 'text-amber-700',
  },
  {
    number: '02',
    Icon: Brain,
    title: 'A Real Conversation',
    subtitle: 'Not a phone tree.',
    description:
      "Voco gathers the caller's name, address, job details, and urgency — naturally. It asks follow-ups, reads tone, and adjusts in real time.",
    detail: '"I understand this is urgent. Let me get you scheduled right away."',
    visualType: 'conversation',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    ringColor: 'ring-sky-200/30',
    numberColor: 'text-sky-400/[0.06]',
    shapeFill: 'bg-sky-400/[0.04]',
    badgeBg: 'bg-sky-50',
    badgeBorder: 'border-sky-200/60',
    badgeText: 'text-sky-700',
  },
  {
    number: '03',
    Icon: CalendarCheck,
    title: 'Booked Before They Hang Up',
    subtitle: 'Calendar confirmed. SMS sent.',
    description:
      'The appointment locks into your calendar while the caller is still on the line. They get an instant text confirmation — no callbacks, no friction.',
    visualType: 'screenshot',
    screenshot: '/images/how-it-works/booking.png',
    screenshotAlt: 'Voco booking calendar with confirmed appointment',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    ringColor: 'ring-emerald-200/30',
    numberColor: 'text-emerald-400/[0.06]',
    shapeFill: 'bg-emerald-400/[0.04]',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200/60',
    badgeText: 'text-emerald-700',
  },
  {
    number: '04',
    Icon: LayoutDashboard,
    title: 'One Dashboard. Everything Managed.',
    subtitle: 'Calendar, invoices, and leads — handled.',
    description:
      'Calls, leads, invoices, and calendar — all in one place. Send estimates, track payments, and sync your schedule without switching apps.',
    visualType: 'screenshot',
    screenshot: '/images/how-it-works/dashboard-ui.png',
    screenshotAlt: 'Voco dashboard with calls, leads, and revenue overview',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    ringColor: 'ring-violet-200/30',
    numberColor: 'text-violet-400/[0.06]',
    shapeFill: 'bg-violet-400/[0.04]',
    badgeBg: 'bg-violet-50',
    badgeBorder: 'border-violet-200/60',
    badgeText: 'text-violet-700',
  },
];

const N = STEPS.length;

/*
  Zero-rerender editorial scroll animation.
  - Editorial split grid layout with alternating text/visual sides.
  - All 4 steps pre-rendered, visibility toggled via refs.
  - RAF loop writes transform/opacity directly (no React re-renders).
  - Visual column gets parallax offset at 0.6x main Y-translate.
  - Watermark numbers get inverse parallax at -0.3x.
  - Progress track + dots updated each frame.
*/

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOut(t) {
  const inv = 1 - t;
  return 1 - inv * inv * inv * inv * inv;
}

export function HowItWorksMinimal() {
  const outerRef = useRef(null);
  const contentRefs = useRef([]);
  const visualRefs = useRef([]);
  const numberRefs = useRef([]);
  const shapeRefs = useRef([]);
  const stickyRef = useRef(null);
  const progressTrackRef = useRef(null);
  const progressDotRefs = useRef([]);
  const progressLabelRef = useRef(null);
  const progressBarRef = useRef(null);
  const mobileTrackRef = useRef(null);
  const mobileDotRefs = useRef([]);
  const mobileLabelRef = useRef(null);

  useEffect(() => {
    // Reduced motion: skip RAF, show all steps statically
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      const el = outerRef.current;
      if (el) {
        el.style.height = 'auto';
      }
      if (stickyRef.current) {
        stickyRef.current.style.position = 'relative';
        stickyRef.current.style.height = 'auto';
      }
      contentRefs.current.forEach((ref) => {
        if (ref) {
          ref.style.opacity = '1';
          ref.style.transform = 'none';
          ref.style.position = 'relative';
          ref.style.inset = 'auto';
          ref.style.marginBottom = '4rem';
        }
      });
      visualRefs.current.forEach((ref) => {
        if (ref) {
          ref.style.opacity = '1';
          ref.style.transform = 'none';
        }
      });
      numberRefs.current.forEach((ref) => {
        if (ref) {
          ref.style.opacity = '1';
          ref.style.transform = 'none';
        }
      });
      shapeRefs.current.forEach((ref) => {
        if (ref) {
          ref.style.opacity = '1';
          ref.style.transform = 'none';
        }
      });
      return;
    }

    let running = true;
    let scrollRange = 0;

    const recalc = () => {
      const el = outerRef.current;
      if (el) {
        const isMobile = window.innerWidth < 768;
        el.style.height = isMobile ? '220vh' : '280vh';
        scrollRange = el.offsetHeight - window.innerHeight;
      }
    };
    recalc();
    window.addEventListener('resize', recalc);

    // Initialise: show step 0, hide rest
    contentRefs.current.forEach((el, i) => {
      if (!el) return;
      if (i === 0) {
        el.style.opacity = '1';
        el.style.transform = 'translate3d(0,0px,0) scale3d(1,1,1)';
      } else {
        el.style.opacity = '0';
        el.style.transform = 'translate3d(0,60px,0) scale3d(0.92,0.92,1)';
      }
    });
    visualRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = i === 0 ? '1' : '0';
      el.style.transform = i === 0 ? 'translate3d(0,0,0)' : 'translate3d(0,36px,0)';
    });
    numberRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = i === 0 ? '1' : '0';
      el.style.transform = i === 0 ? 'translate3d(0,0,0)' : 'translate3d(0,-18px,0)';
    });
    shapeRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = i === 0 ? '1' : '0';
      el.style.transform = i === 0 ? 'scale3d(1,1,1)' : 'scale3d(1.1,1.1,1)';
    });

    const tick = () => {
      if (!running) return;

      const el = outerRef.current;
      if (el && scrollRange > 0) {
        const top = el.getBoundingClientRect().top;
        const scrolled = Math.max(0, Math.min(-top, scrollRange));
        const totalProgress = scrolled / scrollRange;

        const stepFloat = totalProgress * N;
        const active = Math.min(Math.floor(stepFloat), N - 1);
        const rawProgress = Math.max(0, Math.min(1, stepFloat - active));

        const enterEnd = 0.25;
        const exitStart = 0.65;
        const isFirst = active === 0;
        const isLast = active === N - 1;
        const hasNext = active + 1 < N;

        // --- Current step ---
        let cO, cS, cY;
        if (isFirst && rawProgress < enterEnd) {
          cO = 1; cS = 1; cY = 0;
        } else if (rawProgress < enterEnd) {
          const t = easeOut(rawProgress / enterEnd);
          cO = t;
          cS = lerp(0.92, 1, t);
          cY = lerp(60, 0, t);
        } else if (isLast && rawProgress > exitStart) {
          cO = 1; cS = 1; cY = 0;
        } else if (rawProgress > exitStart) {
          const t = easeOut((rawProgress - exitStart) / (1 - exitStart));
          cO = 1 - t;
          cS = lerp(1, 0.97, t);
          cY = lerp(0, -30, t);
        } else {
          cO = 1; cS = 1; cY = 0;
        }

        // --- Next step ---
        let nO = 0, nS = 0.92, nY = 60;
        if (hasNext && rawProgress > exitStart) {
          const t = easeOut((rawProgress - exitStart) / (1 - exitStart));
          nO = t;
          nS = lerp(0.92, 1, t);
          nY = lerp(60, 0, t);
        }

        // --- Shape crossfade ---
        const sf = (rawProgress > exitStart && hasNext)
          ? easeOut((rawProgress - exitStart) / (1 - exitStart))
          : 0;

        // Write all steps
        for (let i = 0; i < N; i++) {
          const cEl = contentRefs.current[i];
          const vEl = visualRefs.current[i];
          const nEl = numberRefs.current[i];
          const sEl = shapeRefs.current[i];

          if (i === active) {
            if (cEl) {
              cEl.style.opacity = cO;
              cEl.style.transform = `translate3d(0,${cY}px,0) scale3d(${cS},${cS},1)`;
            }
            if (vEl) {
              vEl.style.opacity = cO;
              vEl.style.transform = `translate3d(0,${cY * 0.6}px,0)`;
            }
            if (nEl) {
              nEl.style.opacity = cO;
              nEl.style.transform = `translate3d(0,${cY * -0.3}px,0)`;
            }
            if (sEl) {
              sEl.style.opacity = 1 - sf;
              sEl.style.transform = `scale3d(${lerp(1, 0.9, sf)},${lerp(1, 0.9, sf)},1)`;
            }
          } else if (i === active + 1) {
            if (cEl) {
              cEl.style.opacity = nO;
              cEl.style.transform = `translate3d(0,${nY}px,0) scale3d(${nS},${nS},1)`;
            }
            if (vEl) {
              vEl.style.opacity = nO;
              vEl.style.transform = `translate3d(0,${nY * 0.6}px,0)`;
            }
            if (nEl) {
              nEl.style.opacity = nO;
              nEl.style.transform = `translate3d(0,${nY * -0.3}px,0)`;
            }
            if (sEl) {
              sEl.style.opacity = sf;
              sEl.style.transform = `scale3d(${lerp(1.1, 1, sf)},${lerp(1.1, 1, sf)},1)`;
            }
          } else {
            if (cEl) cEl.style.opacity = '0';
            if (vEl) vEl.style.opacity = '0';
            if (nEl) nEl.style.opacity = '0';
            if (sEl) sEl.style.opacity = '0';
          }
        }

        // --- Progress indicator (desktop + mobile) ---
        const fillPct = ((active + rawProgress) / N) * 100;
        if (progressTrackRef.current) progressTrackRef.current.style.width = `${fillPct}%`;
        if (mobileTrackRef.current) mobileTrackRef.current.style.width = `${fillPct}%`;
        if (progressLabelRef.current) progressLabelRef.current.textContent = `Step ${active + 1} of ${N}`;
        if (mobileLabelRef.current) mobileLabelRef.current.textContent = `${active + 1}/${N}`;
        if (progressBarRef.current) progressBarRef.current.setAttribute('aria-valuenow', String(active + 1));

        const activeCls = 'absolute w-3 h-3 rounded-full bg-[#F97316] shadow-[0_0_8px_rgba(249,115,22,0.3)] -translate-x-1/2 -translate-y-1/2 transition-all duration-200';
        const pastCls = 'absolute w-2.5 h-2.5 rounded-full bg-[#F97316]/60 -translate-x-1/2 -translate-y-1/2 transition-all duration-200';
        const futureCls = 'absolute w-2.5 h-2.5 rounded-full bg-[#0F172A]/15 -translate-x-1/2 -translate-y-1/2 transition-all duration-200';
        // Mobile uses smaller dots
        const mActiveCls = 'absolute w-2.5 h-2.5 rounded-full bg-[#F97316] shadow-[0_0_6px_rgba(249,115,22,0.3)] -translate-x-1/2 -translate-y-1/2 transition-all duration-200';
        const mPastCls = 'absolute w-2 h-2 rounded-full bg-[#F97316]/60 -translate-x-1/2 -translate-y-1/2 transition-all duration-200';
        const mFutureCls = 'absolute w-2 h-2 rounded-full bg-[#0F172A]/15 -translate-x-1/2 -translate-y-1/2 transition-all duration-200';

        for (let d = 0; d < N; d++) {
          const dot = progressDotRefs.current[d];
          const mDot = mobileDotRefs.current[d];
          const cls = d === active ? activeCls : d < active ? pastCls : futureCls;
          const mCls = d === active ? mActiveCls : d < active ? mPastCls : mFutureCls;
          if (dot) dot.className = cls;
          if (mDot) mDot.className = mCls;
        }
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    return () => {
      running = false;
      window.removeEventListener('resize', recalc);
    };
  }, []);

  return (
    <div
      ref={outerRef}
      id="hiw-scroll-runway"
      className="relative bg-[#F5F5F4]"
      style={{ height: '280vh' }}
    >
      <style>{`
        .hiw-edge-fade {
          mask-image: linear-gradient(to bottom, black 0%, black 65%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 0%, black 65%, transparent 100%);
        }
        @media (min-width: 768px) {
          .hiw-edge-fade[data-fade-dir="to left"] {
            mask-image:
              linear-gradient(to right, transparent 0%, black 25%, black 100%),
              linear-gradient(to bottom, black 0%, black 75%, transparent 100%);
            -webkit-mask-image:
              linear-gradient(to right, transparent 0%, black 25%, black 100%),
              linear-gradient(to bottom, black 0%, black 75%, transparent 100%);
            mask-composite: intersect;
            -webkit-mask-composite: destination-in;
          }
          .hiw-edge-fade[data-fade-dir="to right"] {
            mask-image:
              linear-gradient(to left, transparent 0%, black 25%, black 100%),
              linear-gradient(to bottom, black 0%, black 75%, transparent 100%);
            -webkit-mask-image:
              linear-gradient(to left, transparent 0%, black 25%, black 100%),
              linear-gradient(to bottom, black 0%, black 75%, transparent 100%);
            mask-composite: intersect;
            -webkit-mask-composite: destination-in;
          }
        }
      `}</style>
      <div ref={stickyRef} className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        {STEPS.map((step, i) => {
          const isEven = i % 2 === 1;

          return (
            <div key={step.number} className="contents">
              {/* Background shape */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                aria-hidden="true"
              >
                <div
                  ref={(el) => { shapeRefs.current[i] = el; }}
                  className={`w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full blur-3xl ${step.shapeFill}`}
                  style={{ willChange: 'transform, opacity' }}
                />
              </div>

              {/* Step content — editorial split grid */}
              <div
                ref={(el) => { contentRefs.current[i] = el; }}
                className="absolute inset-0 flex items-center justify-center px-6"
                style={{ willChange: 'transform, opacity' }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center max-w-6xl mx-auto w-full">
                  {/* Text column — always on top, pushed to outer edge */}
                  <div className={`relative z-20 flex flex-col gap-4 ${isEven ? 'md:order-2 md:pl-4' : 'md:order-1 md:pr-4'}`}>
                    {/* Step badge */}
                    <div>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${step.badgeBg} ${step.badgeBorder} ${step.badgeText}`}
                      >
                        Step {step.number}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl md:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.15] text-[#0F172A]">
                      {step.title}
                    </h3>

                    {/* Accent divider */}
                    <div
                      className="w-16 h-0.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C]/40"
                      aria-hidden="true"
                    />

                    {/* Subtitle */}
                    <p className="text-base md:text-lg font-medium text-[#0F172A]/70">
                      {step.subtitle}
                    </p>

                    {/* Description */}
                    <p className="text-sm md:text-base lg:text-lg text-[#475569] leading-relaxed max-w-md">
                      {step.description}
                    </p>

                    {/* Detail quote (step 02 only) */}
                    {step.detail && (
                      <p className="text-sm md:text-base italic text-[#475569]/70 max-w-md border-l-2 border-[#F97316]/20 pl-4">
                        {step.detail}
                      </p>
                    )}
                  </div>

                  {/* Visual column */}
                  <div
                    className={`relative flex items-center justify-center ${isEven ? 'md:order-1' : 'md:order-2'}`}
                  >
                    {/* Watermark number */}
                    <span
                      ref={(el) => { numberRefs.current[i] = el; }}
                      className={`hidden md:block absolute text-[10rem] lg:text-[12rem] font-semibold leading-none select-none pointer-events-none ${step.numberColor}`}
                      style={{ willChange: 'transform, opacity' }}
                      aria-hidden="true"
                    >
                      {step.number}
                    </span>

                    {/* Visual element */}
                    <div
                      ref={(el) => { visualRefs.current[i] = el; }}
                      className="relative z-10"
                      style={{ willChange: 'transform, opacity' }}
                      aria-hidden="true"
                    >
                      <StepVisual step={step} isEven={isEven} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Progress indicator — desktop */}
        <div
          ref={progressBarRef}
          className="absolute bottom-8 left-0 right-0 max-w-6xl mx-auto px-6 hidden md:flex items-center gap-4"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={1}
          aria-label="How it works progress"
        >
          <div className="flex-1 h-[2px] bg-[#0F172A]/[0.08] rounded-full relative">
            <div
              ref={progressTrackRef}
              className="absolute inset-y-0 left-0 h-[2px] bg-[#F97316] rounded-full"
              style={{ width: '0%', transition: 'none' }}
            />
            {STEPS.map((_, d) => (
              <div
                key={d}
                ref={(el) => { progressDotRefs.current[d] = el; }}
                className="absolute w-2.5 h-2.5 rounded-full bg-[#0F172A]/15 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${(d / (N - 1)) * 100}%`, top: '50%' }}
              />
            ))}
          </div>
          <span
            ref={progressLabelRef}
            className="text-xs text-[#475569] shrink-0 min-w-[80px] text-right"
          >
            Step 1 of 4
          </span>
        </div>

        {/* Progress indicator — mobile (below sticky navbar h-16 = 4rem) */}
        <div
          className="absolute top-20 left-0 right-0 px-6 flex md:hidden items-center gap-3"
          aria-hidden="true"
        >
          <div className="flex-1 h-[2px] bg-[#0F172A]/[0.08] rounded-full relative">
            <div
              ref={mobileTrackRef}
              className="absolute inset-y-0 left-0 h-[2px] bg-[#F97316] rounded-full"
              style={{ width: '0%', transition: 'none' }}
            />
            {STEPS.map((_, d) => (
              <div
                key={d}
                ref={(el) => { mobileDotRefs.current[d] = el; }}
                className="absolute w-2 h-2 rounded-full bg-[#0F172A]/15 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${(d / (N - 1)) * 100}%`, top: '50%' }}
              />
            ))}
          </div>
          <span
            ref={mobileLabelRef}
            className="text-xs text-[#475569]/70 shrink-0"
          >
            1/4
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Visual sub-components (unexported) ── */

function StepVisual({ step, isEven }) {
  switch (step.visualType) {
    case 'conversation':
      return <ConversationMockup isEven={isEven} />;
    case 'screenshot':
      return <ScreenshotVisual src={step.screenshot} alt={step.screenshotAlt} isEven={isEven} />;
    default:
      return <StepIcon step={step} />;
  }
}

function StepIcon({ step }) {
  const { Icon } = step;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`relative w-20 h-20 md:w-28 md:h-28 rounded-3xl flex items-center justify-center ${step.iconBg} ring-[6px] ${step.ringColor}`}>
        <Icon
          className={`w-10 h-10 md:w-14 md:h-14 ${step.iconColor}`}
          strokeWidth={1.5}
        />
      </div>
      {/* Blur blob */}
      <div className={`absolute w-48 h-48 rounded-full ${step.shapeFill} blur-xl -z-10`} />
    </div>
  );
}

function ScreenshotVisual({ src, alt, isEven }) {
  const fadeDir = isEven ? 'to right' : 'to left';
  return (
    <div
      className="hiw-edge-fade w-full"
      data-fade-dir={fadeDir}
    >
      <Image
        src={src}
        alt={alt}
        width={1280}
        height={800}
        className="w-full h-auto"
        quality={75}
      />
    </div>
  );
}

function ConversationMockup({ isEven }) {
  const fadeDir = isEven ? 'to right' : 'to left';
  return (
    <div
      className="hiw-edge-fade w-full"
      data-fade-dir={fadeDir}
    >
      <div className="flex flex-col gap-4">
        {/* Caller bubble 1 */}
        <div>
          <span className="text-[10px] text-[#475569]/60 uppercase tracking-wider font-medium ml-1 mb-1 block">
            Caller
          </span>
          <div className="bg-white/80 backdrop-blur-sm shadow-sm border border-stone-200/40 rounded-2xl rounded-bl-md px-5 py-3 max-w-[85%]">
            <p className="text-sm md:text-base text-[#0F172A]">
              I have a burst pipe in my kitchen&hellip;
            </p>
          </div>
        </div>

        {/* AI bubble */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-[#475569]/60 uppercase tracking-wider font-medium mr-1 mb-1 block">
            Voco AI
          </span>
          <div className="bg-sky-50/90 backdrop-blur-sm shadow-sm border border-sky-200/40 rounded-2xl rounded-br-md px-5 py-3 max-w-[85%]">
            <p className="text-sm md:text-base text-[#0F172A]">
              I understand — let me get you scheduled right away.
            </p>
          </div>
        </div>

        {/* Caller bubble 2 — hidden on small mobile */}
        <div className="hidden sm:block">
          <span className="text-[10px] text-[#475569]/60 uppercase tracking-wider font-medium ml-1 mb-1 block">
            Caller
          </span>
          <div className="bg-white/80 backdrop-blur-sm shadow-sm border border-stone-200/40 rounded-2xl rounded-bl-md px-5 py-3 max-w-[85%]">
            <p className="text-sm md:text-base text-[#0F172A]">
              Can someone come tonight?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

