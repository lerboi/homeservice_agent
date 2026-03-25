'use client';
import { card } from '@/lib/design-tokens';
import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';

export default function CalendarConnectionsPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-4">Calendar Connections</h1>
      <p className="text-sm text-[#475569] mb-4">Connect your calendar to sync appointments automatically.</p>
      <CalendarSyncCard />
    </div>
  );
}
