'use client';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Phone, Brain, CalendarCheck } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Phone,
    title: 'Call comes in',
    description: 'A homeowner calls at 11 PM about a burst pipe. Your AI picks up in under a second.',
    detail: 'No voicemail. No hold music. No missed revenue.',
    accent: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-600',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI triages instantly',
    description: 'The call is classified as an emergency. Your AI shifts tone — faster, more direct.',
    detail: '"I understand this is urgent. Let me get you scheduled right away."',
    accent: 'from-sky-500/20 to-sky-500/5',
    iconColor: 'text-sky-600',
  },
  {
    number: '03',
    icon: CalendarCheck,
    title: 'Job is booked',
    description: 'First available morning slot is locked while the caller is still on the line.',
    detail: 'You get a text. The homeowner gets confirmation. You sleep.',
    accent: 'from-emerald-500/20 to-emerald-500/5',
    iconColor: 'text-emerald-600',
  },
];

export function HowItWorksTabs() {
  const [active, setActive] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  function handleKeyDown(e, i) {
    let next = i;
    if (e.key === 'ArrowRight') {
      next = (i + 1) % steps.length;
    } else if (e.key === 'ArrowLeft') {
      next = (i - 1 + steps.length) % steps.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = steps.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setActive(next);
    const tabs = e.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]');
    tabs[next]?.focus();
  }

  const step = steps[active];
  const Icon = step.icon;

  return (
    <div>
      {/* Tab bar */}
      <div role="tablist" aria-label="How it works steps" className="flex gap-2 justify-center mb-8">
        {steps.map((s, i) => (
          <button
            key={s.number}
            role="tab"
            id={`tab-${s.number}`}
            aria-selected={active === i}
            aria-controls={`panel-${s.number}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`min-h-[48px] px-5 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2 ${
              active === i
                ? 'bg-[#F97316]/10 text-[#F97316] border-b-2 border-[#F97316]'
                : 'text-[#475569]/60 hover:text-[#475569]'
            }`}
          >
            {s.number}
          </button>
        ))}
      </div>

      {/* Animated panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          id={`panel-${step.number}`}
          role="tabpanel"
          aria-labelledby={`tab-${step.number}`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? {} : { opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="rounded-2xl border border-black/[0.04] bg-[#F5F5F4]/50 p-6 md:p-8 min-h-[280px]"
        >
          <div className="md:flex md:items-start md:gap-8">
            {/* Icon container */}
            <div
              className={`relative size-14 rounded-2xl bg-gradient-to-br ${step.accent} flex items-center justify-center shrink-0 border border-black/[0.04] mb-4 md:mb-0`}
            >
              <Icon className={`size-6 ${step.iconColor}`} strokeWidth={1.5} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-1.5">{step.title}</h3>
              <p className="text-[15px] text-[#475569] leading-relaxed">{step.description}</p>
              <p className="text-sm text-[#0F172A]/50 mt-2 italic">{step.detail}</p>
            </div>

            {/* Decorative step number — desktop only */}
            <div className="hidden md:block text-7xl font-semibold text-black/[0.03] leading-none select-none">
              {step.number}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
