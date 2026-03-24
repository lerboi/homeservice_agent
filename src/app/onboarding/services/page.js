'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TRADE_TEMPLATES } from '@/lib/trade-templates';
import { AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';
import { useWizardSession } from '@/hooks/useWizardSession';

const URGENCY_BADGE_CLASSES = {
  emergency: 'bg-red-100 text-red-700 hover:bg-red-100',
  high_ticket: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  routine: 'bg-[#0F172A]/[0.06] text-[#0F172A]/70 hover:bg-[#0F172A]/[0.06]',
};

const URGENCY_LABELS = {
  emergency: 'Emergency',
  high_ticket: 'High-Ticket',
  routine: 'Routine',
};

export default function OnboardingStep3Services() {
  const t = useTranslations('onboarding');
  const router = useRouter();

  const [trade] = useWizardSession('trade', null);
  const [services, setServices] = useWizardSession(
    'services',
    trade ? (TRADE_TEMPLATES[trade]?.services || []).map((svc, idx) => ({ ...svc, id: idx })) : []
  );
  const [submitError, setSubmitError] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [loading, setLoading] = useState(false);

  function handleRemoveService(serviceId) {
    setServices((prev) => prev.filter((s) => s.id !== serviceId));
  }

  function handleAddService(e) {
    e.preventDefault();
    const name = newServiceName.trim();
    if (!name) return;
    setServices((prev) => [
      ...prev,
      { id: Date.now(), name, urgency_tag: 'routine' },
    ]);
    setNewServiceName('');
    setAddingService(false);
  }

  async function handleSubmit() {
    setSubmitError('');
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_type: trade,
          services: services.map(({ name, urgency_tag }) => ({ name, urgency_tag })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || t('error_save_failed'));
        setLoading(false);
        return;
      }

      router.push('/onboarding/contact');
    } catch {
      setSubmitError(t('error_save_failed'));
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 180px)' }}>
      {/* Fixed header */}
      <div className="shrink-0">
        <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
          Your services
        </h1>
        <p className="mt-2 mb-4 text-base text-[#475569]">
          Edit or add services -- your AI will know what you offer.
        </p>
      </div>

      {/* Scrollable service list */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 mb-4">
        {services.length === 0 ? (
          <p className="text-base text-[#475569] mb-3">
            No services yet. Add your first service below.
          </p>
        ) : (
          <AnimatedStagger className="space-y-2">
            {services.map((svc) => (
              <AnimatedItem key={svc.id}>
                <li
                  className="flex items-center justify-between gap-3 px-3 py-2 bg-[#F5F5F4]
                             rounded-xl border border-stone-200 min-h-11 list-none"
                >
                  <span className="text-base text-[#0F172A] flex-1">{svc.name}</span>
                  <Badge
                    className={`text-sm font-normal ${URGENCY_BADGE_CLASSES[svc.urgency_tag] || URGENCY_BADGE_CLASSES.routine}`}
                  >
                    {URGENCY_LABELS[svc.urgency_tag] || 'Routine'}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleRemoveService(svc.id)}
                    aria-label={t('remove_service_aria', { serviceName: svc.name })}
                    className="text-red-600 hover:text-red-700 p-1 rounded focus:outline-none
                               focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1 min-h-[44px] min-w-[44px]
                               flex items-center justify-center"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        )}
      </div>

      {/* Fixed bottom: add service + nav */}
      <div className="shrink-0">
        {/* Add service */}
        {addingService ? (
          <form onSubmit={handleAddService} className="flex gap-2 mb-4">
            <Input
              autoFocus
              type="text"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="Service name"
              className="flex-1 min-h-11 text-base border-stone-200"
            />
            <Button type="submit" className="min-h-11 bg-[#C2410C] hover:bg-[#C2410C]/90 text-white">
              <Plus size={16} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              onClick={() => { setAddingService(false); setNewServiceName(''); }}
              variant="outline"
              className="min-h-11"
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            onClick={() => setAddingService(true)}
            variant="outline"
            className="mb-4 border-stone-200 text-[#475569] hover:bg-stone-50 min-h-11"
          >
            <Plus size={16} className="mr-1" aria-hidden="true" />
            {t('add_service')}
          </Button>
        )}

        {submitError && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {submitError}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/onboarding')}
            disabled={loading}
            className="text-[#475569] hover:text-[#0F172A] px-0 min-h-11"
          >
            {t('back')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-40 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95
                       text-white min-h-11 transition-all duration-150 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
          >
            {t('cta_step3')}
          </Button>
        </div>
      </div>
    </div>
  );
}
