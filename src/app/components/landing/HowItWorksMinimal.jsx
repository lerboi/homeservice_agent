'use client';
import { useRef, useState, useEffect } from 'react';
import { motion, useInView, useScroll, useTransform, useReducedMotion } from 'framer-motion';
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
    bg: 'bg-white',
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
    bg: 'bg-[#FAFAF9]',
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
    bg: 'bg-white',
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
    bg: 'bg-[#FAFAF9]',
  },
];

const FADE_EASE = [0.22, 1, 0.36, 1];

function StepBlock({ step, stepRef, inView, iconY, prefersReducedMotion }) {
  const { Icon } = step;

  const makeMotionProps = (delay) => {
    if (prefersReducedMotion) return {};
    return {
      initial: { opacity: 0, y: 20 },
      animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
      transition: { duration: 0.5, ease: FADE_EASE, delay },
    };
  };

  return (
    <div
      ref={stepRef}
      className={`relative flex flex-col items-center justify-center min-h-screen py-16 md:py-24 lg:py-32 px-4 md:px-6 overflow-hidden ${step.bg}`}
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

      {/* Step content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto gap-5">
        {/* Step number */}
        <motion.span
          className={`text-[5rem] md:text-[6rem] lg:text-[8rem] font-semibold leading-none select-none pointer-events-none ${step.numberColor}`}
          aria-hidden="true"
          {...makeMotionProps(0)}
        >
          {step.number}
        </motion.span>

        {/* Icon container */}
        <motion.div
          className={`w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-3xl flex items-center justify-center ${step.iconBg}`}
          aria-hidden="true"
          style={{ y: prefersReducedMotion ? 0 : iconY }}
          {...makeMotionProps(0.2)}
        >
          <Icon
            className={`w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 ${step.iconColor}`}
            strokeWidth={1.5}
          />
        </motion.div>

        {/* Title */}
        <motion.h3
          className="text-2xl md:text-3xl lg:text-5xl font-semibold tracking-tight leading-[1.2] text-[#0F172A]"
          {...makeMotionProps(0.4)}
        >
          {step.title}
        </motion.h3>

        {/* Gradient accent line */}
        <motion.div
          className="w-20 h-0.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C] origin-left"
          aria-hidden="true"
          initial={prefersReducedMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={
            prefersReducedMotion
              ? {}
              : inView
                ? { scaleX: 1, opacity: 1 }
                : { scaleX: 0, opacity: 0 }
          }
          transition={{ duration: 0.5, ease: FADE_EASE, delay: 0.6 }}
        />

        {/* Description */}
        <motion.p
          className="text-base md:text-lg leading-relaxed text-[#475569]"
          {...makeMotionProps(0.8)}
        >
          {step.description}
        </motion.p>
      </div>
    </div>
  );
}

export function HowItWorksMinimal() {
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Individual refs — must be at top level (not inside .map) per React Rules of Hooks
  const step0Ref = useRef(null);
  const step1Ref = useRef(null);
  const step2Ref = useRef(null);
  const step3Ref = useRef(null);
  const stepRefs = [step0Ref, step1Ref, step2Ref, step3Ref];

  // Individual useInView calls — one per step
  const inView0 = useInView(step0Ref, { once: true, margin: '-20% 0px -20% 0px' });
  const inView1 = useInView(step1Ref, { once: true, margin: '-20% 0px -20% 0px' });
  const inView2 = useInView(step2Ref, { once: true, margin: '-20% 0px -20% 0px' });
  const inView3 = useInView(step3Ref, { once: true, margin: '-20% 0px -20% 0px' });
  const inViews = [inView0, inView1, inView2, inView3];

  // Individual useScroll calls — one per step
  const { scrollYProgress: scroll0 } = useScroll({ target: step0Ref, offset: ['start end', 'end start'] });
  const { scrollYProgress: scroll1 } = useScroll({ target: step1Ref, offset: ['start end', 'end start'] });
  const { scrollYProgress: scroll2 } = useScroll({ target: step2Ref, offset: ['start end', 'end start'] });
  const { scrollYProgress: scroll3 } = useScroll({ target: step3Ref, offset: ['start end', 'end start'] });

  // Individual parallax transforms — one per step
  const iconY0 = useTransform(scroll0, [0, 1], [-12, 12]);
  const iconY1 = useTransform(scroll1, [0, 1], [-12, 12]);
  const iconY2 = useTransform(scroll2, [0, 1], [-12, 12]);
  const iconY3 = useTransform(scroll3, [0, 1], [-12, 12]);
  const iconYs = [iconY0, iconY1, iconY2, iconY3];

  return (
    <div>
      {STEPS.map((step, i) => (
        <StepBlock
          key={step.number}
          step={step}
          stepRef={stepRefs[i]}
          inView={inViews[i]}
          iconY={isMobile || prefersReducedMotion ? 0 : iconYs[i]}
          prefersReducedMotion={!!prefersReducedMotion}
        />
      ))}
    </div>
  );
}
