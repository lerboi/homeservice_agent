'use client';

import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarCheck,
  PhoneOff,
  PhoneMissed,
  Clock,
  MessageSquare,
  Mail,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

const OUTCOME_ROWS = [
  {
    key: 'booked',
    label: 'Booked',
    description: 'Appointment confirmed during the call',
    Icon: CalendarCheck,
  },
  {
    key: 'declined',
    label: 'Declined',
    description: 'Caller explicitly declined to book',
    Icon: PhoneOff,
  },
  {
    key: 'not_attempted',
    label: 'No booking',
    description: 'Call ended without a booking attempt',
    Icon: PhoneMissed,
  },
  {
    key: 'attempted',
    label: 'Slot taken',
    description: 'Booking failed — slot was already taken',
    Icon: Clock,
  },
];

const DEFAULT_PREFS = {
  booked: { sms: true, email: true },
  declined: { sms: false, email: false },
  not_attempted: { sms: false, email: false },
  attempted: { sms: false, email: false },
};

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/notification-settings');
        if (res.ok) {
          const data = await res.json();
          setPrefs(data.notification_preferences || DEFAULT_PREFS);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  const save = useCallback(async (updated) => {
    setSaving(true);
    try {
      await fetch('/api/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preferences: updated }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  }, []);

  function handleToggle(outcomeKey, channel) {
    const updated = {
      ...prefs,
      [outcomeKey]: {
        ...prefs[outcomeKey],
        [channel]: !prefs[outcomeKey][channel],
      },
    };
    setPrefs(updated);
    save(updated);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Column headers — desktop */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_72px_72px] items-center gap-2 px-3 pb-1">
        <div />
        <div className="flex flex-col items-center gap-0.5">
          <MessageSquare className="size-4 text-[#475569]" />
          <span className="text-[11px] font-medium text-[#475569] uppercase tracking-wide">SMS</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Mail className="size-4 text-[#475569]" />
          <span className="text-[11px] font-medium text-[#475569] uppercase tracking-wide">Email</span>
        </div>
      </div>

      {/* Outcome rows */}
      <div className="rounded-xl border border-stone-200/60 divide-y divide-stone-100 overflow-hidden">
        {OUTCOME_ROWS.map((row) => {
          const outcomePrefs = prefs[row.key] || { sms: true, email: true };
          return (
            <div
              key={row.key}
              className="flex flex-col sm:grid sm:grid-cols-[1fr_72px_72px] items-start sm:items-center gap-3 sm:gap-2 px-4 py-4 bg-white"
            >
              {/* Label */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-stone-50 shrink-0">
                  <row.Icon className="size-[18px] text-[#475569]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">{row.label}</p>
                  <p className="text-xs text-[#475569] truncate">{row.description}</p>
                </div>
              </div>

              {/* Toggles — mobile: horizontal row with labels, desktop: aligned to columns */}
              <div className="flex items-center gap-5 sm:contents pl-12 sm:pl-0">
                <label className="flex items-center gap-2 sm:justify-center cursor-pointer">
                  <span className="text-xs text-[#475569] sm:hidden">SMS</span>
                  <Switch
                    checked={outcomePrefs.sms}
                    onCheckedChange={() => handleToggle(row.key, 'sms')}
                    disabled={saving}
                    className="data-[state=checked]:bg-[#C2410C]"
                  />
                </label>
                <label className="flex items-center gap-2 sm:justify-center cursor-pointer">
                  <span className="text-xs text-[#475569] sm:hidden">Email</span>
                  <Switch
                    checked={outcomePrefs.email}
                    onCheckedChange={() => handleToggle(row.key, 'email')}
                    disabled={saving}
                    className="data-[state=checked]:bg-[#C2410C]"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 text-xs text-[#475569]">
          <Loader2 className="size-3 animate-spin" />
          Saving...
        </div>
      )}

      {/* Emergency override notice */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
        <ShieldAlert className="size-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">Emergency override</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Emergency calls always trigger both SMS and email notifications regardless of these settings.
          </p>
        </div>
      </div>
    </div>
  );
}
