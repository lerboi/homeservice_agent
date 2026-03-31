'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
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

/*
  Pure scroll-position-based animation. No Framer Motion useScroll (which has
  positioning bugs in this layout). Instead, a single RAF-throttled scroll
  listener calculates each step's viewport position and derives opacity,
  scale, and translateY from it.

  For each step:
    ratio = how far the step's CENTER is from viewport CENTER,
            normalized to [-1, 1] where 0 = perfectly centered.

    ratio -1 → step is one viewport below center (entering from bottom)
    ratio  0 → step is centered
    ratio +1 → step is one viewport above center (exiting upward)
*/

export function HowItWorksMinimal() {
  const stepRefs = useRef([]);
  const [transforms, setTransforms] = useState(() =>
    STEPS.map(() => ({ opacity: 0, scale: 0.92, y: 40 }))
  );

  const setStepRef = useCallback((el, i) => {
    stepRefs.current[i] = el;
  }, []);

  useEffect(() => {
    let rafId;

    const update = () => {
      const vh = window.innerHeight;
      const vpCenter = vh / 2;

      const newTransforms = stepRefs.current.map((el) => {
        if (!el) return { opacity: 0, scale: 0.92, y: 40 };

        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;

        // ratio: 0 = element centered in viewport
        //       -1 = element center is 1 viewport above vp center (exited up)
        //       +1 = element center is 1 viewport below vp center (not yet entered)
        const ratio = (elCenter - vpCenter) / vh;

        // Clamp to [-1, 1]
        const r = Math.max(-1, Math.min(1, ratio));

        // abs distance from center — 0 at center, 1 at edges
        const dist = Math.abs(r);

        // Opacity: 1 when centered (dist=0), 0 when dist >= 0.5
        const opacity = Math.max(0, 1 - dist * 2.5);

        // Scale: 1 when centered, 0.92 at edges
        const scale = 1 - dist * 0.08;

        // Y: 0 when centered, +40 when below (entering), -40 when above (exiting)
        const y = r * 50;

        return { opacity, scale, y };
      });

      setTransforms(newTransforms);
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Run once on mount
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="bg-[#F5F5F4]">
      {STEPS.map((step, i) => {
        const { Icon } = step;
        const t = transforms[i];

        return (
          <div
            key={step.number}
            ref={(el) => setStepRef(el, i)}
            className="relative h-screen flex items-center justify-center px-4 md:px-6"
          >
            {/* Soft background shape */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              aria-hidden="true"
            >
              <div
                className={`w-[280px] h-[280px] md:w-[400px] md:h-[400px] rounded-full ${step.shapeFill}`}
              />
            </div>

            {/* Content with scroll-driven transforms */}
            <div
              className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto gap-5 will-change-transform"
              style={{
                opacity: t.opacity,
                transform: `scale(${t.scale}) translateY(${t.y}px)`,
              }}
            >
              {/* Step number */}
              <span
                className={`text-[5rem] md:text-[6rem] lg:text-[8rem] font-semibold leading-none select-none pointer-events-none ${step.numberColor}`}
                aria-hidden="true"
              >
                {step.number}
              </span>

              {/* Icon */}
              <div
                className={`w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-3xl flex items-center justify-center ${step.iconBg}`}
                aria-hidden="true"
              >
                <Icon
                  className={`w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 ${step.iconColor}`}
                  strokeWidth={1.5}
                />
              </div>

              {/* Title */}
              <h3 className="text-2xl md:text-3xl lg:text-5xl font-semibold tracking-tight leading-[1.2] text-[#0F172A]">
                {step.title}
              </h3>

              {/* Gradient accent line */}
              <div
                className="w-20 h-0.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C]"
                aria-hidden="true"
              />

              {/* Description */}
              <p className="text-base md:text-lg leading-relaxed text-[#475569]">
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
