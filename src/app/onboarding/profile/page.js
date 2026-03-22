'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TradeSelector } from '@/components/onboarding/TradeSelector';
import { useWizardSession } from '@/hooks/useWizardSession';
import { TRADE_TEMPLATES } from '@/lib/trade-templates';
import { AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';

const TONE_PRESETS = [
  {
    id: 'professional',
    label: 'Professional',
    description: 'Polished and formal — ideal for clients who expect expertise.',
    icon: '🎩',
  },
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Warm and approachable — great for building rapport quickly.',
    icon: '😊',
  },
  {
    id: 'local_expert',
    label: 'Local Expert',
    description: "Neighbourhood-focused — sounds like the person everyone knows.",
    icon: '🏘️',
  },
];

export default function OnboardingProfile() {
  const router = useRouter();

  const [trade, setTrade] = useWizardSession('trade', null);
  const [businessName, setBusinessName] = useWizardSession('business_name', '');
  const [tonePreset, setTonePreset] = useWizardSession('tone_preset', 'professional');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSelectTrade(key) {
    setTrade(key);
    if (error) setError('');
  }

  function handleToneKeyDown(e, presetId) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setTonePreset(presetId);
    }
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
      // First call: save business name + tone preset (creates/upserts tenant)
      const res1 = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName.trim(),
          tone_preset: tonePreset,
        }),
      });

      if (!res1.ok) {
        const data = await res1.json();
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      // Second call: save trade type + pre-populated services
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

        {/* Business name + tone preset — revealed after trade selected */}
        {trade && (
          <div className="space-y-6">
            {/* Business name */}
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

            {/* Tone preset */}
            <div>
              <p className="text-base font-semibold text-[#0F172A] mb-3">
                AI tone of voice
              </p>
              <AnimatedStagger className="space-y-3">
                {TONE_PRESETS.map((preset) => {
                  const isSelected = tonePreset === preset.id;
                  return (
                    <AnimatedItem key={preset.id}>
                      <div
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => setTonePreset(preset.id)}
                        onKeyDown={(e) => handleToneKeyDown(e, preset.id)}
                        className={[
                          'min-h-[80px] flex items-start gap-3 p-4 rounded-2xl border cursor-pointer',
                          'transition-all duration-200',
                          'focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1',
                          isSelected
                            ? 'border-[#C2410C] bg-[#C2410C]/[0.04] shadow-[0_0_0_1px_rgba(194,65,12,0.15)]'
                            : 'border-stone-200 bg-[#F5F5F4] hover:bg-stone-100 hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.04)] hover:-translate-y-0.5',
                        ].join(' ')}
                      >
                        <span className="text-xl mt-0.5" aria-hidden="true">
                          {preset.icon}
                        </span>
                        <div>
                          <p className="text-base font-semibold text-[#0F172A]">
                            {preset.label}
                          </p>
                          <p className="text-sm text-[#475569] mt-0.5">
                            {preset.description}
                          </p>
                        </div>
                      </div>
                    </AnimatedItem>
                  );
                })}
              </AnimatedStagger>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/onboarding')}
            disabled={loading}
            className="text-[#475569] hover:text-[#0F172A] px-0 min-h-11"
          >
            Back
          </Button>

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
