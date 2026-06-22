'use client';
import { card } from '@/lib/design-tokens';
import ServiceAreaManager from '@/components/dashboard/ServiceAreaManager';

export default function ServiceAreaPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-foreground mb-1">Service Area</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Tell your AI which areas you serve. Callers inside your area book as normal; callers outside it
        are handled the way you choose — and you never lose the lead.
      </p>
      <ServiceAreaManager />
    </div>
  );
}
