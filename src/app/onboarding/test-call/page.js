'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TestCallPanel } from '@/components/onboarding/TestCallPanel';
import { clearWizardSession } from '@/hooks/useWizardSession';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function TestCallPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noPhone, setNoPhone] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    async function loadPhoneNumber() {
      try {
        const res = await fetch('/api/onboarding/test-call-status');
        if (!res.ok) {
          setNoPhone(true);
          return;
        }
        const data = await res.json();
        if (data.retell_phone_number) {
          setPhoneNumber(data.retell_phone_number);
        } else {
          setNoPhone(true);
        }
      } catch {
        setNoPhone(true);
      } finally {
        setLoading(false);
      }
    }

    loadPhoneNumber();
  }, []);

  function handleComplete() {
    clearWizardSession();
  }

  function handleGoToDashboard() {
    clearWizardSession();
    router.push('/dashboard');
  }

  async function handleSkipToDashboard() {
    setCompleting(true);
    try {
      // Mark onboarding as complete even without test call
      await fetch('/api/onboarding/complete', { method: 'POST' });
    } catch {
      // Continue to dashboard regardless
    }
    clearWizardSession();
    router.push('/dashboard');
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="size-8 rounded-full border-2 border-[#C2410C] border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (noPhone) {
    return (
      <AnimatedSection>
        <div className="text-center py-4">
          <div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-semibold text-[#0F172A] tracking-tight mb-2">
            You&apos;re all set!
          </h1>
          <p className="text-[15px] text-[#475569] mb-8 max-w-sm mx-auto leading-relaxed">
            Your AI receptionist isn&apos;t provisioned yet, but your account is ready.
            You can test your AI once a phone number is set up.
          </p>
          <Button
            onClick={handleSkipToDashboard}
            disabled={completing}
            className="bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95 text-white min-h-12 px-8 rounded-xl text-[15px] font-medium shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-150"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection>
      <TestCallPanel
        phoneNumber={phoneNumber}
        onComplete={handleComplete}
        onGoToDashboard={handleGoToDashboard}
      />
    </AnimatedSection>
  );
}
