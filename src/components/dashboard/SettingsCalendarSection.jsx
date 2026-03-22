'use client';

import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';

export default function SettingsCalendarSection() {
  return (
    <div id="calendar" className="rounded-2xl border border-stone-200/60 p-6 bg-white">
      <h2 className="text-base font-semibold text-[#0F172A]">
        Calendar Connections
      </h2>
      <p className="text-sm text-[#475569] mt-1">
        Connect your calendar to sync appointments automatically.
      </p>
      <div className="mt-4">
        <CalendarSyncCard />
      </div>
    </div>
  );
}
