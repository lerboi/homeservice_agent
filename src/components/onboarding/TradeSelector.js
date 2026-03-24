'use client';

import { Wrench, Thermometer, Zap, Hammer } from 'lucide-react';
import { TRADE_TEMPLATES } from '@/lib/trade-templates';
import { AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';

const TRADE_ICONS = {
  plumber: Wrench,
  hvac: Thermometer,
  electrician: Zap,
  general_handyman: Hammer,
};

export function TradeSelector({ selected, onSelect }) {
  function handleKeyDown(e, key) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(key);
    }
  }

  return (
    <AnimatedStagger
      role="radiogroup"
      aria-label="Select your trade"
      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
    >
      {Object.entries(TRADE_TEMPLATES).map(([key, trade]) => {
        const isSelected = selected === key;
        const Icon = TRADE_ICONS[key] || Wrench;

        return (
          <AnimatedItem key={key}>
            <div
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onSelect(key)}
              onKeyDown={(e) => handleKeyDown(e, key)}
              className={[
                'flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border cursor-pointer min-h-[72px]',
                'focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1',
                'transition-all duration-150',
                isSelected
                  ? 'border-[#C2410C] bg-[#C2410C]/[0.04] shadow-[0_0_0_1px_rgba(194,65,12,0.15)]'
                  : 'border-stone-200 bg-[#F5F5F4] hover:-translate-y-0.5',
              ].join(' ')}
            >
              <Icon
                size={20}
                aria-hidden="true"
                className={isSelected ? 'text-[#C2410C]' : 'text-[#475569]'}
              />
              <span className="text-sm font-semibold text-[#0F172A] text-center leading-tight">
                {trade.label}
              </span>
            </div>
          </AnimatedItem>
        );
      })}
    </AnimatedStagger>
  );
}
