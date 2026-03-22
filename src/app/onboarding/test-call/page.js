'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TestCallPanel } from '@/components/onboarding/TestCallPanel';
import { clearWizardSession } from '@/hooks/useWizardSession';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

export default function TestCallPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provisionError, setProvisionError] = useState(false);

  useEffect(() => {
    async function loadPhoneNumber() {
      try {
        const res = await fetch('/api/onboarding/test-call-status');
        if (!res.ok) {
          setProvisionError(true);
          return;
        }
        const data = await res.json();
        if (data.retell_phone_number) {
          setPhoneNumber(data.retell_phone_number);
        } else {
          setProvisionError(true);
        }
      } catch {
        setProvisionError(true);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="size-8 rounded-full border-2 border-[#C2410C] border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (provisionError) {
    return (
      <AnimatedSection>
        <Alert variant="destructive">
          <AlertDescription>
            Your AI phone number hasn&apos;t been provisioned yet. Go back and complete the previous steps.
          </AlertDescription>
        </Alert>
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
