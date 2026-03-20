'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OnboardingComplete() {
  const router = useRouter();

  return (
    <div>
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
          <CheckCircle className="relative h-12 w-12 text-green-600" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
          You&apos;re all set!
        </h1>
      </div>
      <p className="mb-8 text-base text-[#475569] text-center">
        Your AI assistant is configured and ready. Head to the dashboard to manage your services and view incoming calls.
      </p>

      <Button
        type="button"
        onClick={() => router.push('/dashboard/services')}
        className="w-full min-h-11 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] text-white
                   shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-150"
      >
        Go to dashboard
      </Button>

      <p className="mt-4 text-sm text-[#475569]/60 text-center">
        Phone number provisioning and test calls will be available once Retell is configured.
      </p>
    </div>
  );
}
