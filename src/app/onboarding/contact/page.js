'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWizardSession } from '@/hooks/useWizardSession';

export default function OnboardingStep3Contact() {
  const router = useRouter();

  const [phone, setPhone] = useWizardSession('phone', '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/onboarding/sms-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save. Please try again.');
        setLoading(false);
        return;
      }
      router.push('/onboarding/test-call');
    } catch {
      setError('Failed to save. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
        Contact details
      </h1>
      <p className="mt-2 mb-6 text-base text-[#475569]">
        Add your phone number so we can send you a test call.
      </p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="owner_phone" className="text-base font-normal text-[#0F172A]">
          Phone number <span className="text-[#475569]/60 text-sm">(optional)</span>
        </Label>
        <Input
          id="owner_phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 000 0000"
          className="min-h-11 border-stone-200 text-base focus:border-[#C2410C]"
        />
        <p className="text-xs text-[#94A3B8] mt-1">
          We&apos;ll use this to demo your AI receptionist with a live call.
        </p>
      </div>

      <div className="flex items-center justify-between mt-8">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/onboarding/services')}
          disabled={loading}
          className="text-[#475569] hover:text-[#0F172A] px-0 min-h-11"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="w-full sm:w-40 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95
                     text-white min-h-11 transition-all duration-150 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </div>
  );
}
