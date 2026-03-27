'use client';
import { useState } from 'react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

const AVG_JOB_VALUES = [
  { label: '$250', value: 250 },
  { label: '$500', value: 500 },
  { label: '$750', value: 750 },
  { label: '$1,000', value: 1000 },
  { label: '$1,500', value: 1500 },
  { label: '$2,000+', value: 2000 },
];

export default function ROICalculator() {
  const [missedCalls, setMissedCalls] = useState(5);
  const [avgJobValue, setAvgJobValue] = useState(750);

  // ~30% of missed calls would have converted to a booked job
  const conversionRate = 0.3;
  const monthlyLoss = Math.round(missedCalls * 4 * conversionRate * avgJobValue);
  const yearlyLoss = monthlyLoss * 12;

  return (
    <AnimatedSection>
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#0F172A] text-center mb-2 tracking-tight leading-[1.3]">
          What Are Missed Calls Costing You?
        </h2>
        <p className="text-sm text-[#64748B] text-center mb-8">
          Most contractors lose 3-10 calls per week. Even at a 30% booking rate, the math adds up fast.
        </p>

        <div className="bg-white border border-stone-200/60 rounded-xl p-6 md:p-8 shadow-sm">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Missed calls slider */}
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-3">
                Missed calls per week
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={missedCalls}
                onChange={(e) => setMissedCalls(Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-[#F97316] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#F97316] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(249,115,22,0.4)] [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#F97316] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(249,115,22,0.4)]"
              />
              <div className="flex justify-between mt-2">
                <span className="text-xs text-[#94A3B8]">1</span>
                <span className="text-lg font-semibold text-[#F97316]">{missedCalls}</span>
                <span className="text-xs text-[#94A3B8]">20</span>
              </div>
            </div>

            {/* Average job value */}
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-3">
                Average job value
              </label>
              <div className="grid grid-cols-3 gap-2">
                {AVG_JOB_VALUES.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAvgJobValue(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      avgJobValue === opt.value
                        ? 'bg-[#F97316] text-white shadow-sm'
                        : 'bg-stone-100 text-[#475569] hover:bg-stone-200 hover:text-[#0F172A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="mt-8 pt-6 border-t border-stone-200/60 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
            <div className="text-center">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Monthly revenue lost</p>
              <p className="text-3xl font-semibold text-red-500">
                ${monthlyLoss.toLocaleString()}
              </p>
            </div>
            <div className="hidden md:block w-px h-12 bg-stone-200" />
            <div className="text-center">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Yearly revenue lost</p>
              <p className="text-3xl font-semibold text-red-500">
                ${yearlyLoss.toLocaleString()}
              </p>
            </div>
            <div className="hidden md:block w-px h-12 bg-stone-200" />
            <div className="text-center">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Voco starts at</p>
              <p className="text-3xl font-semibold text-[#F97316]">$79/mo</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">billed annually</p>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
