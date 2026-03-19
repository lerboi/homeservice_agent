'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OnboardingComplete() {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle className="h-8 w-8 text-green-600 shrink-0" aria-hidden="true" />
        <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
          You&apos;re all set!
        </h1>
      </div>
      <p className="mb-8 text-base text-slate-500">
        Your AI assistant is configured and ready. Head to the dashboard to manage your services and view incoming calls.
      </p>

      <Button
        type="button"
        onClick={() => router.push('/dashboard/services')}
        className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white"
      >
        Go to dashboard
      </Button>

      <p className="mt-4 text-sm text-slate-400 text-center">
        Phone number provisioning and test calls will be available once Retell is configured.
      </p>
    </div>
  );
}
