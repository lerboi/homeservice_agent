'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { card, heading, body } from '@/lib/design-tokens';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

const FEATURES = [
  {
    key: 'invoicing',
    label: 'Invoicing',
    description: "Create invoices and estimates, send payment reminders, and track what you're owed.",
    icon: Zap,
  },
  // Future flags appended here; matching shape.
];

export default function FeaturesPage() {
  const initial = useFeatureFlags();

  // Local optimistic state — we update immediately on Switch toggle, then
  // reconcile with the server response. On error we roll back to `initial`.
  const [enabled, setEnabled] = useState({ invoicing: initial.invoicing });
  const [pendingKey, setPendingKey] = useState(null);

  // Flip-off dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCounts, setPendingCounts] = useState({ invoices: 0, estimates: 0 });
  const [confirmPending, setConfirmPending] = useState(false);

  async function patchFeatures(nextValue) {
    const prevValue = enabled.invoicing;
    setEnabled({ invoicing: nextValue }); // optimistic
    setPendingKey('invoicing');

    try {
      const res = await fetch('/api/tenant/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: { invoicing: nextValue } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Success toast only on disable confirmation flow (silent on enable per UI-SPEC).
      if (!nextValue) {
        toast.success('Invoicing disabled. Re-enable here anytime.');
      }
    } catch {
      // Rollback
      setEnabled({ invoicing: prevValue });
      toast.error(
        nextValue
          ? 'Failed to enable invoicing. Try again.'
          : 'Failed to disable invoicing. Try again.'
      );
    } finally {
      setPendingKey(null);
    }
  }

  async function handleToggleInvoicing(nextValue) {
    if (nextValue) {
      // Flip ON — always silent.
      await patchFeatures(true);
      return;
    }

    // Flip OFF — fetch counts. If 0/0, silent flip. Otherwise, dialog.
    setPendingKey('invoicing');
    let counts = { invoices: 0, estimates: 0 };
    try {
      const res = await fetch('/api/tenant/invoicing-counts');
      if (res.ok) counts = await res.json();
    } catch {
      // If counts fetch fails, fall through to silent flip — the cron filter
      // and proxy gate still protect the data; the dialog is informational only.
    }
    setPendingKey(null);

    if ((counts.invoices ?? 0) === 0 && (counts.estimates ?? 0) === 0) {
      await patchFeatures(false);
      return;
    }

    setPendingCounts(counts);
    setConfirmOpen(true);
  }

  async function handleConfirmDisable() {
    setConfirmPending(true);
    await patchFeatures(false);
    setConfirmPending(false);
    setConfirmOpen(false);
  }

  function handleCancelDisable() {
    setConfirmOpen(false);
    // Switch is bound to `enabled.invoicing`, which is still `true` because
    // patchFeatures was never called. No state to revert.
  }

  function buildDescription({ invoices, estimates }) {
    if (invoices > 0 && estimates > 0) {
      return `You have ${invoices} invoice(s) and ${estimates} estimate(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`;
    }
    if (invoices > 0) {
      return `You have ${invoices} invoice(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`;
    }
    return `You have ${estimates} estimate(s) on file. Disabling invoicing hides the invoicing tools from your dashboard — your data is preserved and you can re-enable anytime from this page.`;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className={`text-xl font-semibold ${heading}`}>Features</h1>
        <Separator className="mt-3" />
      </div>

      <div className={`${card.base} p-6 space-y-0 divide-y divide-border`}>
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          const isEnabled = enabled[feature.key] === true;
          const isPending = pendingKey === feature.key;

          return (
            <div
              key={feature.key}
              className="flex items-center justify-between gap-4 py-5 first:pt-0 last:pb-0 min-h-[64px]"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${heading}`}>{feature.label}</p>
                  <p className={`text-xs ${body} mt-1`}>{feature.description}</p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={(next) => {
                  if (feature.key === 'invoicing') handleToggleInvoicing(next);
                }}
                disabled={isPending}
                aria-label={`${feature.label} — ${isEnabled ? 'on' : 'off'}`}
              />
            </div>
          );
        })}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable invoicing?</AlertDialogTitle>
            <AlertDialogDescription>
              {buildDescription(pendingCounts)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDisable}>
              Keep Invoicing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisable}
              disabled={confirmPending}
              className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]"
            >
              {confirmPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
