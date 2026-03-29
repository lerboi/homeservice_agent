'use client';
import { card } from '@/lib/design-tokens';
import ZoneManager from '@/components/dashboard/ZoneManager';

export default function ServiceZonesPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-1">Service Zones & Travel</h1>
      <p className="text-sm text-[#475569] mb-6">Define the areas you serve. Zones help your AI suggest the right time slots and account for travel between jobs.</p>
      <ZoneManager />
    </div>
  );
}
