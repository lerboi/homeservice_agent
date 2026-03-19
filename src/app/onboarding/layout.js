'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';

function getStep(pathname) {
  if (pathname === '/onboarding') return 1;
  if (pathname === '/onboarding/services') return 2;
  if (pathname === '/onboarding/verify') return 3;
  return 1;
}

export default function OnboardingLayout({ children }) {
  const pathname = usePathname();
  const t = useTranslations('onboarding');
  const currentStep = getStep(pathname);
  const progressValue = (currentStep / 3) * 100;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-24 bg-slate-200 rounded" aria-label="HomeService AI logo" />
          <span className="text-sm text-slate-500">
            {t('step_counter', { step: currentStep })}
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={progressValue}
          className="h-1 mb-8 transition-all duration-300"
          role="progressbar"
          aria-valuenow={progressValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('step_counter', { step: currentStep })}
        />

        {/* Wizard card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-8 sm:px-8
                        max-sm:rounded-none max-sm:shadow-none max-sm:border-none max-sm:px-4 max-sm:py-6">
          <div aria-live="polite" className="w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
