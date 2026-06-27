'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { Briefcase, Wrench, UserCircle, CreditCard, Check, LogOut } from 'lucide-react';
import { GridTexture } from '@/components/ui/grid-texture';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { supabase } from '@/lib/supabase-browser';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';

function getStep(pathname) {
  if (pathname === '/onboarding') return 1;
  if (pathname === '/onboarding/services') return 2;
  if (pathname === '/onboarding/contact') return 3;
  if (pathname === '/onboarding/checkout') return 4;
  return 1;
}

const TOTAL_STEPS = 4;

const STEP_ICONS = [Briefcase, Wrench, UserCircle, CreditCard];

function StepIndicator({ currentStep, completed }) {
  return (
    <div className="flex items-center gap-1.5" role="list" aria-label="Onboarding steps">
      {STEP_ICONS.map((Icon, i) => {
        const stepNum = i + 1;
        const isDone = completed || stepNum < currentStep;
        const isCurrent = !completed && stepNum === currentStep;
        return (
          <div key={stepNum} className="flex items-center gap-1.5" role="listitem">
            <div
              className={`flex items-center justify-center size-7 rounded-full transition-all duration-500 ${
                isDone
                  ? 'bg-emerald-500 text-white scale-100'
                  : isCurrent
                    ? 'bg-[#C2410C] text-white ring-4 ring-[#C2410C]/10'
                    : 'bg-stone-100 text-stone-400'
              }`}
            >
              {isDone ? (
                <Check className="size-3.5" strokeWidth={2.5} />
              ) : (
                <Icon className="size-3.5" />
              )}
            </div>
            {i < STEP_ICONS.length - 1 && (
              <div
                className={`w-2.5 sm:w-6 h-px transition-colors duration-500 ${
                  isDone ? 'bg-emerald-400' : 'bg-stone-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OnboardingLayoutInner({ children }) {
  const pathname = usePathname();
  const t = useTranslations('onboarding');
  const { completed } = useOnboarding();
  const currentStep = getStep(pathname);

  const [signingOut, setSigningOut] = useState(false);
  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Redirect regardless — a failed sign-out shouldn't trap the user here.
    }
    window.location.href = '/auth/signin';
  }

  return (
    <div data-onboarding-root className="min-h-screen bg-[#F5F5F4] relative">
      <GridTexture variant="light" />
      {/* Subtle orange radial gradient at top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(194,65,12,0.06) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-2xl mx-auto px-6 py-8 sm:py-12">
        {/* Header with logo + step indicators */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center group">
            <Image
              src="/images/logos/VOCO%20Logo%20V1%20(no%20bg).png"
              alt="Voco"
              width={100}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-5">
            <StepIndicator currentStep={currentStep} completed={completed} />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label={t('sign_out')}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C2410C]/40 rounded"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{signingOut ? t('signing_out') : t('sign_out')}</span>
            </button>
          </div>
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

export default function OnboardingLayout({ children }) {
  return (
    <OnboardingProvider>
      <OnboardingLayoutInner>{children}</OnboardingLayoutInner>
    </OnboardingProvider>
  );
}
