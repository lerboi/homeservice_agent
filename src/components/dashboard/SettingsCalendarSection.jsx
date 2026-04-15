'use client';

import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';

export default function SettingsCalendarSection() {
  return (
    <div id="calendar" className="rounded-2xl border border-border p-6 bg-card">
      <h2 className="text-base font-semibold text-foreground">
        Calendar Connections
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Connect your calendar to sync appointments automatically.
      </p>
      <div className="mt-4">
        <CalendarSyncCard />
      </div>
    </div>
  );
}
