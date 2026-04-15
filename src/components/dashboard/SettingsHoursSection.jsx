'use client';

import WorkingHoursEditor from '@/components/dashboard/WorkingHoursEditor';

export default function SettingsHoursSection() {
  return (
    <div id="hours" className="rounded-2xl border border-border p-6 bg-card">
      <h2 className="text-base font-semibold text-foreground">
        Working Hours
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Set when your business accepts calls and appointments.
      </p>
      <div className="mt-4">
        <WorkingHoursEditor />
      </div>
    </div>
  );
}
