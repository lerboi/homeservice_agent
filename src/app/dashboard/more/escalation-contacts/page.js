'use client';
import { card } from '@/lib/design-tokens';
import { EscalationChainSection } from '@/components/dashboard/EscalationChainSection';

export default function EscalationContactsPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-1">Escalation Contacts</h1>
      <p className="text-sm text-[#475569] mb-6">When an emergency call comes in, your AI tries each contact in order before offering a booking slot or callback.</p>
      <EscalationChainSection />
    </div>
  );
}
