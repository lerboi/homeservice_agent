'use client';
import { card } from '@/lib/design-tokens';
import WorkingHoursEditor from '@/components/dashboard/WorkingHoursEditor';

export default function WorkingHoursPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-4">Working Hours</h1>
      <WorkingHoursEditor />
    </div>
  );
}
