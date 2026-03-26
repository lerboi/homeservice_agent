'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TradeSelector } from '@/components/onboarding/TradeSelector';
import { useWizardSession } from '@/hooks/useWizardSession';
import { TRADE_TEMPLATES } from '@/lib/trade-templates';

export default function OnboardingProfile() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [trade, setTrade] = useWizardSession('trade', null);
  const [businessName, setBusinessName] = useWizardSession('business_name', '');
  const [selectedPlan, setSelectedPlan] = useWizardSession('selected_plan', null);
  const [selectedInterval, setSelectedInterval] = useWizardSession('selected_interval', null);

  // Capture plan selection from pricing page URL params
  useEffect(() => {
    const plan = searchParams.get('plan');
    const interval = searchParams.get('interval');

    if (plan && ['starter', 'growth', 'scale'].includes(plan)) {
      setSelectedPlan(plan);
      setSelectedInterval(interval === 'annual' ? 'annual' : 'monthly');
    }
    // No redirect if plan is missing — user may have come directly
  }, [searchParams, setSelectedPlan, setSelectedInterval]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSelectTrade(key) {
    setTrade(key);
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!trade) {
      setError('Please select your trade type.');
      return;
    }
    if (!businessName.trim()) {
      setError('Enter your business name.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Save business name (creates/upserts tenant)
      const res1 = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName.trim(),
          tone_preset: 'professional',
        }),
      });

      if (!res1.ok) {
        const data = await res1.json();
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      // Save trade type + pre-populated services
      const res2 = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_type: trade,
          services: TRADE_TEMPLATES[trade].services,
        }),
      });

      if (!res2.ok) {
        const data = await res2.json();
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      router.push('/onboarding/services');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
        Set up your business
      </h1>
      <p className="mt-2 mb-6 text-base text-[#475569]">
        We&apos;ll pre-fill your service list based on your trade.
      </p>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Trade selector */}
        <div className="mb-6">
          <TradeSelector selected={trade} onSelect={handleSelectTrade} />
        </div>

        {/* Business name — revealed after trade selected */}
        {trade && (
          <div>
            <Label
              htmlFor="business_name"
              className="text-base text-[#0F172A] mb-1.5 block"
            >
              Business name
            </Label>
            <Input
              id="business_name"
              type="text"
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Smith Plumbing & Heating"
              disabled={loading}
              aria-invalid={!!error && !businessName.trim()}
              className="min-h-11 border-stone-200 focus:border-[#C2410C]"
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-end mt-8">
          <Button
            type="submit"
            disabled={loading || !trade}
            className="w-full sm:w-40 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95 text-white min-h-11 transition-all duration-150 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
