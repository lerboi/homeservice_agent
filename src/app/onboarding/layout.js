'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { GridTexture } from '@/components/ui/grid-texture';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

function getStep(pathname) {
  if (pathname === '/onboarding') return 1;
  if (pathname === '/onboarding/services') return 2;
  if (pathname === '/onboarding/contact') return 3;
  if (pathname === '/onboarding/test-call') return 4;
  return 1;
}

const TOTAL_STEPS = 4;

export default function OnboardingLayout({ children }) {
  const pathname = usePathname();
  const t = useTranslations('onboarding');
  const currentStep = getStep(pathname);
  const progressValue = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-[#F5F5F4] relative">
      <GridTexture variant="light" />
      {/* Subtle orange radial gradient at top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(194,65,12,0.06) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-lg mx-auto px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
              </svg>
            </div>
            <span className="text-[#0F172A] font-semibold text-[15px] tracking-tight">
              Voco
            </span>
          </Link>
          <span className="text-sm text-[#475569]">
            {t('step_counter', { step: currentStep, total: TOTAL_STEPS })}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="relative h-1 mb-8 rounded-full bg-[#0F172A]/[0.08] overflow-hidden"
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label="Onboarding progress"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#C2410C] transition-all duration-500 ease-out"
            style={{ width: `${progressValue}%` }}
          />
        </div>

        {/* Wizard card */}
        <AnimatedSection>
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_6px_24px_-4px_rgba(0,0,0,0.06)] border border-stone-200/60 px-6 py-8 sm:px-8
                          max-sm:rounded-none max-sm:shadow-none max-sm:border-none max-sm:px-4 max-sm:py-6">
            <div aria-live="polite" className="w-full">
              {children}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
