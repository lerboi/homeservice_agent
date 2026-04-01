'use client';
import { useEffect, useRef } from 'react';
import { Phone, Brain, CalendarCheck, LayoutDashboard } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    Icon: Phone,
    title: 'Call Comes In',
    description: 'Your phone rings. Voco picks up instantly.',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    numberColor: 'text-amber-400/15',
    shapeFill: 'bg-amber-400/[0.05]',
  },
  {
    number: '02',
    Icon: Brain,
    title: 'AI Handles the Conversation',
    description: 'It gathers the details. No scripts. No hold music.',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    numberColor: 'text-sky-400/15',
    shapeFill: 'bg-sky-400/[0.05]',
  },
  {
    number: '03',
    Icon: CalendarCheck,
    title: 'Job Is Booked',
    description: 'The appointment locks in before the caller hangs up.',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    numberColor: 'text-emerald-400/15',
    shapeFill: 'bg-emerald-400/[0.05]',
  },
  {
    number: '04',
    Icon: LayoutDashboard,
    title: 'Your Dashboard Does the Rest',
    description: 'Wake up to a full schedule and zero missed calls.',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    numberColor: 'text-violet-400/15',
    shapeFill: 'bg-violet-400/[0.05]',
  },
];

const N = STEPS.length;

/*
  Zero-rerender scroll animation with continuous RAF loop.
  - All 4 steps pre-rendered, visibility toggled via refs.
  - Runs every frame (not scroll-event-driven) for guaranteed smoothness.
  - easeOut cubic for snappy, punchy transitions.
  - translate3d / scale3d for explicit GPU compositing.
*/

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Fast start, smooth settle
function easeOut(t) {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

export function HowItWorksMinimal() {
  const outerRef = useRef(null);
  const contentRefs = useRef([]);
  const shapeRefs = useRef([]);

  useEffect(() => {
    let running = true;

    // Cache scrollRange (doesn't change unless window resizes)
    let scrollRange = 0;
    const recalc = () => {
      const el = outerRef.current;
      if (el) scrollRange = el.offsetHeight - window.innerHeight;
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
        el.style.transform = 'translate3d(0,100px,0) scale3d(0.85,0.85,1)';
      }
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

        const enterEnd = 0.2;
        const exitStart = 0.8;
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
          cS = lerp(0.85, 1, t);
          cY = lerp(100, 0, t);
        } else if (isLast && rawProgress > exitStart) {
          cO = 1; cS = 1; cY = 0;
        } else if (rawProgress > exitStart) {
          const t = easeOut((rawProgress - exitStart) / (1 - exitStart));
          cO = 1 - t;
          cS = lerp(1, 0.85, t);
          cY = lerp(0, -100, t);
        } else {
          cO = 1; cS = 1; cY = 0;
        }

        // --- Next step ---
        let nO = 0, nS = 0.85, nY = 100;
        if (hasNext && rawProgress > exitStart) {
          const t = easeOut((rawProgress - exitStart) / (1 - exitStart));
          nO = t;
          nS = lerp(0.85, 1, t);
          nY = lerp(100, 0, t);
        }

        // --- Shape crossfade ---
        const sf = (rawProgress > exitStart && hasNext)
          ? easeOut((rawProgress - exitStart) / (1 - exitStart))
          : 0;

        // Write all steps
        for (let i = 0; i < N; i++) {
          const cEl = contentRefs.current[i];
          const sEl = shapeRefs.current[i];

          if (i === active) {
            if (cEl) {
              cEl.style.opacity = cO;
              cEl.style.transform = `translate3d(0,${cY}px,0) scale3d(${cS},${cS},1)`;
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
            if (sEl) {
              sEl.style.opacity = sf;
              sEl.style.transform = `scale3d(${lerp(1.1, 1, sf)},${lerp(1.1, 1, sf)},1)`;
            }
          } else {
            if (cEl) cEl.style.opacity = '0';
            if (sEl) sEl.style.opacity = '0';
          }
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
      className="bg-[#F5F5F4]"
      style={{ height: `${N * 100}vh` }}
    >
      <div className="sticky top-0 h-screen flex items-center justify-center">
        {STEPS.map((step, i) => (
          <div key={step.number} className="contents">
            {/* Background shape */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
              <div
                ref={(el) => { shapeRefs.current[i] = el; }}
                className={`w-[280px] h-[280px] md:w-[400px] md:h-[400px] rounded-full ${step.shapeFill}`}
                style={{ willChange: 'transform, opacity' }}
              />
            </div>

            {/* Step content */}
            <div
              ref={(el) => { contentRefs.current[i] = el; }}
              className="absolute inset-0 flex items-center justify-center px-4 md:px-6"
              style={{ willChange: 'transform, opacity' }}
            >
              <StepContent step={step} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepContent({ step }) {
  const { Icon } = step;
  return (
    <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto gap-5">
      <span
        className={`text-[5rem] md:text-[6rem] lg:text-[8rem] font-semibold leading-none select-none pointer-events-none ${step.numberColor}`}
        aria-hidden="true"
      >
        {step.number}
      </span>

      <div
        className={`w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-3xl flex items-center justify-center ${step.iconBg}`}
        aria-hidden="true"
      >
        <Icon
          className={`w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 ${step.iconColor}`}
          strokeWidth={1.5}
        />
      </div>

      <h3 className="text-2xl md:text-3xl lg:text-5xl font-semibold tracking-tight leading-[1.2] text-[#0F172A]">
        {step.title}
      </h3>

      <div
        className="w-20 h-0.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C]"
        aria-hidden="true"
      />

      <p className="text-base md:text-lg leading-relaxed text-[#475569]">
        {step.description}
      </p>
    </div>
  );
}
