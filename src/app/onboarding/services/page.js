'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TRADE_TEMPLATES } from '@/lib/trade-templates';

const TRADE_KEYS = Object.keys(TRADE_TEMPLATES);

const URGENCY_BADGE_CLASSES = {
  emergency: 'bg-red-100 text-red-700 hover:bg-red-100',
  high_ticket: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  routine: 'bg-slate-100 text-slate-600 hover:bg-slate-100',
};

const URGENCY_LABELS = {
  emergency: 'Emergency',
  high_ticket: 'High-Ticket',
  routine: 'Routine',
};

function TradeCard({ tradeKey, label, isSelected, onSelect }) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(tradeKey);
    }
  }

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(tradeKey)}
      onKeyDown={handleKeyDown}
      className={`
        flex flex-col items-center justify-center p-4 rounded-lg border cursor-pointer min-h-[80px]
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1
        ${isSelected
          ? 'border-blue-600 bg-blue-50'
          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
        }
      `}
    >
      <span className="text-base font-semibold text-slate-900 text-center">{label}</span>
    </div>
  );
}

export default function OnboardingStep2() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [services, setServices] = useState([]);
  const [tradeError, setTradeError] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSelectTrade(tradeKey) {
    setSelectedTrade(tradeKey);
    setTradeError('');
    setServices(TRADE_TEMPLATES[tradeKey].services.map((svc, idx) => ({ ...svc, id: idx })));
  }

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
    if (!selectedTrade) {
      setTradeError(t('error_no_trade'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_type: selectedTrade,
          services: services.map(({ name, urgency_tag }) => ({ name, urgency_tag })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setTradeError(data.error || t('error_save_failed'));
        setLoading(false);
        return;
      }

      router.push('/onboarding/verify');
    } catch {
      setTradeError(t('error_save_failed'));
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
        {t('step2_heading')}
      </h1>
      <p className="mt-2 mb-6 text-base text-slate-500">
        {t('step2_subtext')}
      </p>

      {/* Trade template cards */}
      <div className="mb-6">
        <p className="text-base font-semibold text-slate-900 mb-3">
          {t('trade_section_label')}
        </p>
        <div className="grid grid-cols-2 gap-4" role="radiogroup" aria-label={t('trade_section_label')}>
          {TRADE_KEYS.map((key) => (
            <TradeCard
              key={key}
              tradeKey={key}
              label={TRADE_TEMPLATES[key].label}
              isSelected={selectedTrade === key}
              onSelect={handleSelectTrade}
            />
          ))}
        </div>
        {tradeError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {tradeError}
          </p>
        )}
      </div>

      {/* Service list */}
      {services.length > 0 && (
        <div className="mb-8">
          <p className="text-base font-semibold text-slate-900 mb-1">
            {t('services_section_label')}
          </p>
          <p className="text-sm text-slate-500 mb-3">
            {t('services_section_helper')}
          </p>
          <ul className="space-y-2">
            {services.map((svc) => (
              <li
                key={svc.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50
                           rounded-lg border border-slate-200 min-h-11"
              >
                <span className="text-base text-slate-900 flex-1">{svc.name}</span>
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
                             focus:ring-2 focus:ring-red-600 focus:ring-offset-1 min-h-[44px] min-w-[44px]
                             flex items-center justify-center"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {/* Add service */}
          {addingService ? (
            <form onSubmit={handleAddService} className="mt-3 flex gap-2">
              <Input
                autoFocus
                type="text"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Service name"
                className="flex-1 min-h-11 text-base border-slate-200"
              />
              <Button type="submit" className="min-h-11 bg-blue-600 hover:bg-blue-700 text-white">
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
              className="mt-3 border-slate-200 text-slate-700 hover:bg-slate-50 min-h-11"
            >
              <Plus size={16} className="mr-1" aria-hidden="true" />
              {t('add_service')}
            </Button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/onboarding')}
          disabled={loading}
          className="text-slate-500 hover:text-slate-700 px-0 min-h-11"
        >
          {t('back')}
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full sm:w-40 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95
                     text-white min-h-11 transition-all duration-150"
        >
          {t('cta_step2')}
        </Button>
      </div>
    </div>
  );
}
