'use client';
import { card } from '@/lib/design-tokens';
import NotificationPreferences from '@/components/dashboard/NotificationPreferences';

export default function NotificationsPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-1">Notifications</h1>
      <p className="text-sm text-[#475569] mb-6">
        Choose how you get notified for each type of call outcome.
      </p>
      <NotificationPreferences />
    </div>
  );
}
