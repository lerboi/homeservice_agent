'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

const MISSED_CALL_OPTIONS = [
  { label: '3', value: 3 },
  { label: '5', value: 5 },
  { label: '8', value: 8 },
  { label: '10', value: 10 },
  { label: '15', value: 15 },
  { label: '20', value: 20 },
];

const AVG_JOB_VALUES = [
  { label: '$250', value: 250 },
  { label: '$500', value: 500 },
  { label: '$750', value: 750 },
  { label: '$1,000', value: 1000 },
  { label: '$1,500', value: 1500 },
  { label: '$2,000+', value: 2000 },
];

function InlineSelect({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`inline appearance-none bg-transparent border-0 border-b-2 border-[#F97316] text-[#F97316] font-bold cursor-pointer focus:outline-none focus:border-[#F97316] px-1 ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function DrawnUnderline() {
  return (
    <svg
      className="absolute -bottom-2 left-0 w-full h-3 pointer-events-none"
      viewBox="0 0 230 12"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M 2 7 C 25 2, 45 11, 70 5 S 110 10, 135 4 S 170 10, 195 6 S 218 3, 228 7"
        stroke="#F97316"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

export default function ROICalculator() {
  const [missedCalls, setMissedCalls] = useState(5);
  const [avgJobValue, setAvgJobValue] = useState(750);

  const conversionRate = 0.3;
  const monthlyLoss = Math.round(missedCalls * 4 * conversionRate * avgJobValue);
  const yearlyLoss = monthlyLoss * 12;

  const vocoMonthly = 79;
  const dailyRecovery = monthlyLoss / 30;
  const paybackDays = dailyRecovery > 0 ? Math.max(1, Math.ceil(vocoMonthly / dailyRecovery)) : 0;

  return (
    <AnimatedSection>
      <div className="max-w-3xl mx-auto">
        {/* Title with hand-drawn underline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0F172A] text-center mb-10 tracking-tight leading-[1.2]">
          What Are Missed Calls{' '}
          <span className="relative inline-block text-[#F97316]">
            Costing You?
            <DrawnUnderline />
          </span>
        </h2>

        {/* The sentence — inputs inline with text */}
        <p className="text-lg md:text-xl text-[#334155] leading-relaxed text-center">
          If you miss{' '}
          <InlineSelect
            value={missedCalls}
            onChange={setMissedCalls}
            options={MISSED_CALL_OPTIONS}
            className="text-lg md:text-xl"
          />
          {' '}calls a week and your average job is worth{' '}
          <InlineSelect
            value={avgJobValue}
            onChange={setAvgJobValue}
            options={AVG_JOB_VALUES}
            className="text-lg md:text-xl"
          />
          , you&apos;re leaving
        </p>

        {/* The punchline — big red number */}
        <p className="text-center mt-5">
          <span className="text-5xl md:text-6xl font-bold text-red-500 tabular-nums transition-all duration-300">
            ${monthlyLoss.toLocaleString()}
          </span>
          <span className="text-lg text-red-400/70 ml-2">/month</span>
        </p>
        <p className="text-center text-sm text-[#64748B] mt-1.5">
          That&apos;s <span className="font-semibold text-red-500">${yearlyLoss.toLocaleString()}</span> per year walking out the door.
        </p>

        {/* Divider */}
        <div className="flex items-center gap-5 my-10">
          <div className="flex-1 h-px bg-[#0F172A]/[0.08]" />
          <span className="text-sm font-semibold text-[#F97316]/60 uppercase tracking-widest">vs</span>
          <div className="flex-1 h-px bg-[#0F172A]/[0.08]" />
        </div>

        {/* Voco price — the answer */}
        <div className="text-center">
          <p className="text-xs text-[#F97316] uppercase tracking-wider font-semibold mb-2">Voco AI Receptionist</p>
          <p className="text-5xl md:text-6xl font-bold text-[#F97316]">
            $79<span className="text-2xl md:text-3xl font-semibold text-[#F97316]/50">/mo</span>
          </p>
          <p className="text-sm text-[#64748B] mt-2">
            Pays for itself in <span className="font-semibold text-[#0F172A]">{paybackDays} {paybackDays === 1 ? 'day' : 'days'}</span> &middot; Billed annually &middot; 14-day free trial
          </p>
          <Link
            href="#pricing-plans"
            className="inline-flex items-center gap-1.5 mt-6 px-6 py-3 rounded-lg bg-[#F97316] text-white text-sm font-medium shadow-[0_4px_12px_rgba(249,115,22,0.3)] hover:bg-[#F97316]/90 hover:-translate-y-0.5 transition-all"
          >
            Start Free Trial
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </AnimatedSection>
  );
}
