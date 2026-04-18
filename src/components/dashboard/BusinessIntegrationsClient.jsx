'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Loader2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { card } from '@/lib/design-tokens';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

// Brand logos — inline SVG so no runtime bundle cost beyond these two components.
// Xero glyph path sourced from simple-icons (MIT-licensed); Jobber wordmark is
// a pill + stylized "J" approximation using Jobber's brand green (#1B9F4F).
function XeroIcon({ className }) {
  return (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Xero">
      <title>Xero</title>
      <path fill="#13B5EA" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.585 14.655c-1.485 0-2.69-1.206-2.69-2.689 0-1.485 1.207-2.691 2.69-2.691 1.485 0 2.69 1.207 2.69 2.691s-1.207 2.689-2.69 2.689zM7.53 14.644c-.099 0-.192-.041-.267-.116l-2.043-2.04-2.052 2.047c-.069.068-.16.108-.258.108-.202 0-.368-.166-.368-.368 0-.099.04-.191.111-.263l2.04-2.05-2.038-2.047c-.075-.069-.113-.162-.113-.261 0-.203.166-.366.368-.366.098 0 .188.037.258.105l2.055 2.048 2.048-2.045c.069-.071.162-.108.26-.108.211 0 .375.165.375.366 0 .098-.029.188-.104.258l-2.056 2.055 2.055 2.051c.068.069.104.16.104.258 0 .202-.165.368-.365.368h-.01zm11.055-4.602c-1.064 0-1.931.865-1.931 1.931 0 1.064.866 1.931 1.931 1.931s1.931-.867 1.931-1.931c0-1.065-.866-1.933-1.931-1.933v.002zm0 2.595c-.367 0-.666-.297-.666-.666 0-.367.3-.665.666-.665.367 0 .667.299.667.665 0 .369-.3.667-.667.666z" />
    </svg>
  );
}

function JobberIcon({ className }) {
  return (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Jobber">
      <title>Jobber</title>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#1B9F4F" />
      <path fill="#ffffff" d="M15.5 5.75v8.9c0 2.53-1.86 3.72-4.05 3.72-1.7 0-3-.66-3.9-1.82l1.9-1.76c.46.56 1.12.92 1.94.92.92 0 1.55-.52 1.55-1.72V5.75h2.56z" />
    </svg>
  );
}

// UI-SPEC locks these exact strings. Do NOT paraphrase.
const PROVIDER_META = {
  xero: {
    id: 'xero',
    name: 'Xero',
    Icon: XeroIcon,
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
    Icon: JobberIcon,
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
 * Phase 53's FeatureFlagsProvider is the CANONICAL invoicing-flag source and
 * is now merged. `useFeatureFlags()` returns DEFAULT_FLAGS ({ invoicing: false })
 * when no Provider is mounted — so the hook itself handles the "outside the
 * dashboard tree" case. Call it unconditionally per the Rules of Hooks.
 */
function useInvoicingFlag() {
  const flags = useFeatureFlags();
  return Boolean(flags?.invoicing);
}

function statusLineFor(providerMeta, connected, invoicing) {
  if (!connected) return providerMeta.disconnectedStatus;
  if (invoicing) return providerMeta.connectedStatusInvoicingOn;
  return providerMeta.connectedStatusInvoicingOff;
}

export default function BusinessIntegrationsClient({ initialStatus }) {
  const searchParams = useSearchParams();
  const invoicing = useInvoicingFlag(); // boolean (synchronous from Context)

  // Convert server-provided { xero, jobber } shape into {provider: row} map
  const [status, setStatus] = useState(() => ({
    xero: initialStatus?.xero || null,
    jobber: initialStatus?.jobber || null,
  }));
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [confirmConnectTarget, setConfirmConnectTarget] = useState(null);

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

  function requestConnect(providerKey) {
    if (!invoicing) {
      setConfirmConnectTarget(providerKey);
      return;
    }
    handleConnect(providerKey);
  }

  async function handleConnect(providerKey) {
    const meta = PROVIDER_META[providerKey];
    setConfirmConnectTarget(null);
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
            const row = status[providerKey];
            const connected = Boolean(row);
            const hasError = connected && row?.error_state === 'token_refresh_failed';
            const lastFetch = connected && row?.last_context_fetch_at
              ? row.last_context_fetch_at
              : null;
            const isConnecting = connecting === providerKey;
            const isDisconnecting = disconnecting === providerKey;

            return (
              <div key={providerKey} className={`${card.base} p-5 flex flex-col`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center h-8 w-8 bg-muted rounded-lg">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{meta.name}</span>
                  {providerKey === 'jobber' && connected && !hasError && status.xero !== null && (
                    <span className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Preferred
                    </span>
                  )}
                </div>

                {hasError ? (
                  <div className="flex-1 mb-4">
                    <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                      <AlertDescription>
                        Reconnect needed — {meta.name} token expired. Your AI receptionist can&apos;t access {meta.name} customer info until you reconnect.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <p
                    className={
                      connected
                        ? 'flex-1 text-sm text-emerald-600 dark:text-emerald-400 mb-4'
                        : 'flex-1 text-sm text-muted-foreground mb-4'
                    }
                  >
                    {statusLineFor(meta, connected, invoicing)}
                    {lastFetch && (
                      <span className="block mt-1 text-xs text-muted-foreground font-normal">
                        Last synced {formatDistanceToNow(parseISO(lastFetch), { addSuffix: true })}
                      </span>
                    )}
                  </p>
                )}

                {hasError ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="w-full bg-[var(--brand-accent)] text-white hover:bg-[var(--brand-accent)]/90"
                      onClick={() => handleConnect(providerKey)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                          Reconnecting…
                        </>
                      ) : (
                        `Reconnect ${meta.name}`
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                      onClick={() => setDisconnectTarget(providerKey)}
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </Button>
                  </div>
                ) : connected ? (
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
                    onClick={() => requestConnect(providerKey)}
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
        open={!!confirmConnectTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmConnectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmConnectTarget
                ? `Connect ${PROVIDER_META[confirmConnectTarget].name} and turn on invoicing?`
                : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmConnectTarget
                ? `Connecting ${PROVIDER_META[confirmConnectTarget].name} enables invoice sync, so invoicing will be turned on in your dashboard. You'll see Invoices appear in the sidebar and lead actions. You can turn invoicing off anytime from More → Features.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--brand-accent)] text-white hover:bg-[var(--brand-accent)]/90"
              onClick={() => confirmConnectTarget && handleConnect(confirmConnectTarget)}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
