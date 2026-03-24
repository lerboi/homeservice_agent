'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';
import SettingsAISection from '@/components/dashboard/SettingsAISection';
import SettingsHoursSection from '@/components/dashboard/SettingsHoursSection';
import SettingsCalendarSection from '@/components/dashboard/SettingsCalendarSection';

export default function SettingsPage() {
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenant() {
      try {
        const { data } = await supabase
          .from('tenants')
          .select('retell_phone_number')
          .single();
        setPhoneNumber(data?.retell_phone_number ?? null);
      } catch { /* ignore */ }
      setLoading(false);
    }
    loadTenant();
  }, []);

  // Anchor scroll after render
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-[#0F172A] mb-2">Settings</h1>
      <SettingsAISection phoneNumber={phoneNumber} loading={loading} />
      <SettingsHoursSection />
      <SettingsCalendarSection />
    </div>
  );
}
