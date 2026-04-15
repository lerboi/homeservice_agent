'use client';
import { card } from '@/lib/design-tokens';
import WorkingHoursEditor from '@/components/dashboard/WorkingHoursEditor';

export default function WorkingHoursPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 id="working-hours-heading" className="text-xl font-semibold text-foreground mb-1">Working Hours</h1>
      <p className="text-sm text-muted-foreground mb-6">Set when you are available so your AI only books open slots.</p>
      <WorkingHoursEditor />
    </div>
  );
}
