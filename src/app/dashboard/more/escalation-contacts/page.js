'use client';
import { card } from '@/lib/design-tokens';
import { EscalationChainSection } from '@/components/dashboard/EscalationChainSection';

export default function EscalationContactsPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-4">Escalation Contacts</h1>
      <EscalationChainSection />
    </div>
  );
}
