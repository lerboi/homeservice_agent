'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// ============================================================
// Provider config
// ============================================================
const PROVIDER_CONFIG = {
  google: {
    label: 'Google Calendar',
    authEndpoint: '/api/google-calendar/auth',
    popupName: 'google-calendar-auth',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    connectedParam: 'connected',
    errorParam: 'error',
  },
  outlook: {
    label: 'Outlook Calendar',
    authEndpoint: '/api/outlook-calendar/auth',
    popupName: 'outlook-calendar-auth',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    connectedParam: 'outlook_connected',
    errorParam: 'outlook_error',
  },
};

// ============================================================
// SyncStatusDot
// ============================================================
function SyncStatusDot({ status }) {
  const configs = {
    synced: {
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-600',
      label: 'Up to date',
      hideLabel: true,
    },
    syncing: {
      dotClass: 'bg-[var(--brand-accent)] animate-pulse',
      textClass: 'text-[var(--brand-accent)]',
      label: 'Syncing...',
    },
    error: {
      dotClass: 'bg-red-500',
      textClass: 'text-red-600',
      label: 'Sync error',
    },
    reauth: {
      dotClass: 'bg-amber-500',
      textClass: 'text-amber-600',
      label: 'Re-authorization required',
    },
  };

  const config = configs[status];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm shrink-0 ${config.textClass}`}
      role="status"
      aria-label={config.label}
      title={config.label}
    >
      <span className={`w-2 h-2 rounded-full ${config.dotClass} inline-block`} />
      {!config.hideLabel && config.label}
    </span>
  );
}

// ============================================================
// CalendarProviderRow
// ============================================================
function CalendarProviderRow({
  provider,
  data,
  onConnect,
  onDisconnect,
  isConnecting,
  isDisconnecting,
  otherConnected,
  otherLabel,
}) {
  const config = PROVIDER_CONFIG[provider];

  // Derive sync status — connected calendars are "synced" unless the watch channel expired
  function deriveSyncStatus() {
    if (!data) return 'synced';
    // If watch channel has expired, the webhook can't deliver updates
    if (data.watch_expiration && data.watch_expiration < Date.now()) return 'error';
    return 'synced';
  }

  // Not connected row
  if (!data) {
    const blockedByOther = Boolean(otherConnected);
    return (
      <div className="flex items-center justify-between gap-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg ${config.iconBg} shrink-0`}>
            <CalendarDays className={`h-4 w-4 ${config.iconColor}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{config.label}</span>
            <p className="text-xs text-muted-foreground">
              {blockedByOther
                ? `Disconnect ${otherLabel} first to switch`
                : 'Not connected'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onConnect(provider)}
          disabled={isConnecting || blockedByOther}
          aria-label={`Connect ${config.label}`}
          className="shrink-0"
        >
          {isConnecting ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            'Connect'
          )}
        </Button>
      </div>
    );
  }

  // Connected row
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg ${config.iconBg} shrink-0`}>
            <CalendarDays className={`h-4 w-4 ${config.iconColor}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{config.label}</span>
            {data.calendar_name && (
              <p className="text-xs text-muted-foreground truncate">{data.calendar_name}</p>
            )}
          </div>
        </div>
        <SyncStatusDot status={deriveSyncStatus()} />
      </div>

      <div className="flex items-center gap-2 mt-2 pl-9">
        {data.last_synced_at && (
          <span className="text-[11px] text-muted-foreground mr-auto">
            Synced {formatDistanceToNow(new Date(data.last_synced_at), { addSuffix: true })}
          </span>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="text-[11px] text-muted-foreground hover:text-red-600 transition-colors"
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect {config.label}?</AlertDialogTitle>
              <AlertDialogDescription>
                New appointments will no longer sync to your {config.label}. Existing calendar
                events will not be deleted. You can reconnect at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDisconnect(provider)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ============================================================
// CalendarSyncCard (main export)
// ============================================================
export default function CalendarSyncCard() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState({ google: null, outlook: null });
  const [oauthError, setOauthError] = useState(null); // null | 'google' | 'outlook' | 'admin_consent'
  const [connectingProvider, setConnectingProvider] = useState(null); // null | 'google' | 'outlook'
  const [disconnectingProvider, setDisconnectingProvider] = useState(null);
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadStatus();

    // Listen for postMessage from OAuth popup
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      const { type, provider } = event.data || {};
      if (type === 'calendar-connected') {
        const config = PROVIDER_CONFIG[provider];
        loadStatus();
        setConnectingProvider(null);
        if (config) toast.success(`${config.label} connected.`);
      } else if (type === 'calendar-error') {
        setConnectingProvider(null);
        setOauthError(event.data.reason === 'admin_consent' ? 'admin_consent' : (provider || 'google'));
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStatus() {
    try {
      const res = await fetch('/api/calendar-sync/status');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setProviders({ google: data.google, outlook: data.outlook });
    } catch {
      // Silently fail -- calendar sync is non-critical
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider) {
    setOauthError(null);
    setConnectingProvider(provider);
    const config = PROVIDER_CONFIG[provider];

    try {
      const res = await fetch(config.authEndpoint);
      if (!res.ok) throw new Error('Failed to get auth URL');
      const { url } = await res.json();

      // Open OAuth popup
      const popup = window.open(
        url,
        config.popupName,
        'width=600,height=700,left=200,top=100'
      );
      popupRef.current = popup;

      // Poll for popup close
      pollRef.current = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(pollRef.current);
          await loadStatus();
          setConnectingProvider(null);
        }
      }, 500);
    } catch {
      setOauthError(provider);
      setConnectingProvider(null);
    }
  }

  async function handleDisconnect(provider) {
    const config = PROVIDER_CONFIG[provider];
    setDisconnectingProvider(provider);
    try {
      const res = await fetch('/api/calendar-sync/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error('Disconnect failed');
      await loadStatus();
      toast.success(`${config.label} disconnected.`);
    } catch {
      toast.error(`Couldn't disconnect ${config.label}. Try again.`);
    } finally {
      setDisconnectingProvider(null);
    }
  }

  // Loading state
  if (loading) {
    return (
      <section className="space-y-3">
        <div className="h-10 rounded-lg animate-pulse bg-muted" />
        <div className="h-10 rounded-lg animate-pulse bg-muted" />
      </section>
    );
  }

  return (
    <section>

      {/* OAuth error alerts */}
      {oauthError === 'google' && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>Google Calendar authorization failed.</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-4 shrink-0"
              onClick={() => {
                setOauthError(null);
                handleConnect('google');
              }}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {oauthError === 'outlook' && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>Outlook Calendar authorization failed.</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-4 shrink-0"
              onClick={() => {
                setOauthError(null);
                handleConnect('outlook');
              }}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {oauthError === 'admin_consent' && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>
              Your organization requires admin approval to connect Outlook Calendar. Contact your
              IT administrator to approve this app.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-4 shrink-0"
              onClick={() => {
                setOauthError(null);
                handleConnect('outlook');
              }}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="divide-y divide-border">
        <CalendarProviderRow
          provider="google"
          data={providers.google}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          isConnecting={connectingProvider === 'google'}
          isDisconnecting={disconnectingProvider === 'google'}
          otherConnected={Boolean(providers.outlook)}
          otherLabel={PROVIDER_CONFIG.outlook.label}
        />
        <CalendarProviderRow
          provider="outlook"
          data={providers.outlook}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          isConnecting={connectingProvider === 'outlook'}
          isDisconnecting={disconnectingProvider === 'outlook'}
          otherConnected={Boolean(providers.google)}
          otherLabel={PROVIDER_CONFIG.google.label}
        />
      </div>
    </section>
  );
}
