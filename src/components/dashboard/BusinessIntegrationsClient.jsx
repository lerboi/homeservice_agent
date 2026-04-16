'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { FileSpreadsheet, Wrench, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { card } from '@/lib/design-tokens';

// UI-SPEC Open Question #4 + CONTEXT.md D-10 architectural intent:
// FeatureFlagsProvider (Phase 53) is the CANONICAL invoicing-flag source.
// Import at module top so useFeatureFlags() runs at render time (primary path).
// Phase 53's useFeatureFlags() already returns DEFAULT_FLAGS ({ invoicing: false })
// when no Provider is mounted — so the hook itself is the fallback mechanism.
// The try/catch below guards ONLY the case where the Phase 53 module file is
// missing entirely (unlikely once Phase 53 merges; defensive for mid-merge window).
let useFeatureFlagsHook;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  useFeatureFlagsHook = require('@/components/FeatureFlagsProvider').useFeatureFlags;
} catch {
  useFeatureFlagsHook = null;
}

// UI-SPEC locks these exact strings. Do NOT paraphrase.
const PROVIDER_META = {
  xero: {
    id: 'xero',
    name: 'Xero',
    Icon: FileSpreadsheet,
    connectLabel: 'Connect Xero',
    connectSuccessToast: 'Xero connected.',
    connectErrorToast: "Couldn't connect to Xero. Please try again.",
    startErrorToast: "Couldn't start the Xero connection. Please try again.",
    disconnectErrorToast: "Couldn't disconnect Xero. Please try again.",
    disconnectedStatus:
      'Connect Xero to share customer history with your AI receptionist during calls.',
    connectedStatusInvoicingOff:
      'Connected. Sharing customer context with your AI receptionist.',
    connectedStatusInvoicingOn:
      'Connected. Sharing customer context and sending invoices.',
    dialogTitle: 'Disconnect Xero?',
    dialogBody:
      'Your AI receptionist will stop sharing Xero customer history during calls. If invoicing is on, invoices will also stop syncing to Xero. Previously synced invoices are not affected. You can reconnect anytime.',
  },
  jobber: {
    id: 'jobber',
    name: 'Jobber',
    Icon: Wrench,
    connectLabel: 'Connect Jobber',
    connectSuccessToast: 'Jobber connected.',
    connectErrorToast: "Couldn't connect to Jobber. Please try again.",
    startErrorToast: "Couldn't start the Jobber connection. Please try again.",
    disconnectErrorToast: "Couldn't disconnect Jobber. Please try again.",
    disconnectedStatus:
      'Connect Jobber to share customer and job history with your AI receptionist during calls.',
    connectedStatusInvoicingOff:
      'Connected. Sharing customer and job history with your AI receptionist.',
    connectedStatusInvoicingOn:
      'Connected. Sharing customer history and sending invoices.',
    dialogTitle: 'Disconnect Jobber?',
    dialogBody:
      'Your AI receptionist will stop sharing Jobber customer and job history during calls. If invoicing is on, invoices will also stop syncing to Jobber. Previously synced data is not affected. You can reconnect anytime.',
  },
};

const PROVIDER_ORDER = ['xero', 'jobber'];

/**
 * Resolves the invoicing feature flag per UI-SPEC Open Question #4 (RESOLVED).
 *
 * PRIMARY path: call useFeatureFlags() at render time. Phase 53 guarantees that
 * the hook returns DEFAULT_FLAGS ({ invoicing: false }) if no Provider is
 * mounted, so no extra fallback logic is needed for the "Provider not wrapping
 * this page" case.
 *
 * FALLBACK path: fetch /api/tenant/features — exercised ONLY if the Phase 53
 * module file itself is missing (useFeatureFlagsHook resolved to null at the
 * module-load try/catch above). This is a defensive guard for the brief window
 * between Phase 54 merging and Phase 53 wiring stabilising across all branches.
 *
 * Net effect after Phase 53 is merged: useFeatureFlags() is the primary (and
 * only) path. Fetch fallback is dead code kept for merge-order resilience.
 */
function useInvoicingFlag() {
  // Primary path — always call the hook if the module resolved.
  // NOTE: Hooks must be called unconditionally. The decision of which path
  // to take is made at module-load time (useFeatureFlagsHook === null?), not
  // per-render — so calling the hook here is safe React-hooks-rules-wise.
  if (useFeatureFlagsHook) {
    const flags = useFeatureFlagsHook();
    return Boolean(flags?.invoicing);
  }

  // Fallback path — Phase 53 module not found. Fetch the API route instead.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [invoicing, setInvoicing] = useState(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let mounted = true;
    fetch('/api/tenant/features')
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setInvoicing(Boolean(data?.invoicing));
      })
      .catch(() => {
        if (mounted) setInvoicing(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  return invoicing;
}

function statusLineFor(providerMeta, connected, invoicing) {
  if (!connected) return providerMeta.disconnectedStatus;
  if (invoicing) return providerMeta.connectedStatusInvoicingOn;
  return providerMeta.connectedStatusInvoicingOff;
}

export default function BusinessIntegrationsClient({ initialStatus }) {
  const searchParams = useSearchParams();
  const invoicing = useInvoicingFlag(); // null | boolean

  // Convert server-provided { xero, jobber } shape into {provider: row} map
  const [status, setStatus] = useState(() => ({
    xero: initialStatus?.xero || null,
    jobber: initialStatus?.jobber || null,
  }));
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);

  // OAuth callback landing toast (UI-SPEC copy verbatim)
  useEffect(() => {
    const connected = searchParams.get('connected');
    const errParam = searchParams.get('error');
    const errProvider = searchParams.get('provider');

    if (connected && PROVIDER_META[connected]) {
      toast.success(PROVIDER_META[connected].connectSuccessToast);
    }
    if (errParam) {
      const providerKey = PROVIDER_META[errProvider] ? errProvider : null;
      const meta = providerKey ? PROVIDER_META[providerKey] : null;
      toast.error(
        meta
          ? meta.connectErrorToast
          : "Couldn't complete the integration. Please try again.",
      );
    }
  }, [searchParams]);

  async function handleConnect(providerKey) {
    const meta = PROVIDER_META[providerKey];
    setConnecting(providerKey);
    try {
      const res = await fetch(`/api/integrations/${providerKey}/auth`);
      const { url, error } = await res.json();
      if (error || !url) {
        toast.error(meta.startErrorToast);
        setConnecting(null);
        return;
      }
      window.location.href = url; // full-page redirect per UI-SPEC
    } catch {
      toast.error(meta.startErrorToast);
      setConnecting(null);
    }
  }

  async function handleDisconnect(providerKey) {
    const meta = PROVIDER_META[providerKey];
    setDisconnecting(providerKey);
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerKey }),
      });
      if (!res.ok) throw new Error('disconnect failed');
      setStatus((prev) => ({ ...prev, [providerKey]: null }));
    } catch {
      toast.error(meta.disconnectErrorToast);
    } finally {
      setDisconnecting(null);
      setDisconnectTarget(null);
    }
  }

  // Still resolving invoicing flag? Show skeleton cards.
  const showSkeletons = invoicing === null;

  return (
    <>
      {showSkeletons ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
          {PROVIDER_ORDER.map((key) => (
            <div key={key} className={`${card.base} p-5`}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROVIDER_ORDER.map((providerKey) => {
            const meta = PROVIDER_META[providerKey];
            const Icon = meta.Icon;
            const connected = Boolean(status[providerKey]);
            const isConnecting = connecting === providerKey;
            const isDisconnecting = disconnecting === providerKey;

            return (
              <div key={providerKey} className={`${card.base} p-5 flex flex-col`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center h-8 w-8 bg-muted rounded-lg">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{meta.name}</span>
                </div>

                <p
                  className={
                    connected
                      ? 'flex-1 text-sm text-emerald-600 dark:text-emerald-400 mb-4'
                      : 'flex-1 text-sm text-muted-foreground mb-4'
                  }
                >
                  {statusLineFor(meta, connected, invoicing)}
                </p>

                {connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    onClick={() => setDisconnectTarget(providerKey)}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                        Disconnecting…
                      </>
                    ) : (
                      'Disconnect'
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full bg-[var(--brand-accent)] text-white hover:bg-[var(--brand-accent)]/90"
                    onClick={() => handleConnect(providerKey)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                        Connecting…
                      </>
                    ) : (
                      meta.connectLabel
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disconnectTarget ? PROVIDER_META[disconnectTarget].dialogTitle : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disconnectTarget ? PROVIDER_META[disconnectTarget].dialogBody : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => disconnectTarget && handleDisconnect(disconnectTarget)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
