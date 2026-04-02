'use client';
import { useState, useEffect } from 'react';
import { card } from '@/lib/design-tokens';
import { supabase } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import SettingsAISection from '@/components/dashboard/SettingsAISection';

export default function AIVoiceSettingsPage() {
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenant() {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('phone_number')
          .single();
        if (error) throw error;
        setPhoneNumber(data?.phone_number ?? null);
      } catch (err) {
        console.error('[ai-voice-settings] Failed to load tenant:', err?.message || err);
        toast.error('Failed to load voice settings. Please refresh.');
      }
      setLoading(false);
    }
    loadTenant();
  }, []);

  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-1">AI & Voice Settings</h1>
      <p className="text-sm text-[#475569] mb-6">Your AI phone number and test call.</p>
      <SettingsAISection phoneNumber={phoneNumber} loading={loading} />
    </div>
  );
}
