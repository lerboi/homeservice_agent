'use client';
import { card } from '@/lib/design-tokens';
import ZoneManager from '@/components/dashboard/ZoneManager';

export default function ServiceZonesPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-4">Service Zones & Travel</h1>
      <ZoneManager />
    </div>
  );
}
