'use client';
import { card } from '@/lib/design-tokens';
import NotificationPreferences from '@/components/dashboard/NotificationPreferences';
import { EscalationChainSection } from '@/components/dashboard/EscalationChainSection';
import { Separator } from '@/components/ui/separator';

export default function NotificationsAndEscalationPage() {
  return (
    <div className="space-y-6">
      {/* Notifications section */}
      <div className={`${card.base} p-6`}>
        <h1 className="text-xl font-semibold text-foreground mb-1">Notifications</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Choose how you get notified for each type of call outcome.
        </p>
        <NotificationPreferences />
      </div>

      {/* Escalation contacts section */}
      <div className={`${card.base} p-6`}>
        <h2 className="text-xl font-semibold text-foreground mb-1">Escalation Contacts</h2>
        <p className="text-sm text-muted-foreground mb-6">
          When an emergency call comes in, your AI tries each contact in order before offering a booking slot or callback.
        </p>
        <EscalationChainSection />
      </div>
    </div>
  );
}
