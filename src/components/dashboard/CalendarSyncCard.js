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
    },
    syncing: {
      dotClass: 'bg-[#C2410C] animate-pulse',
      textClass: 'text-[#C2410C]',
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
      className={`inline-flex items-center gap-1.5 text-sm ${config.textClass}`}
      role="status"
      aria-label={config.label}
    >
      <span className={`w-2 h-2 rounded-full ${config.dotClass} inline-block`} />
      {config.label}
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
  onMakePrimary,
  isConnecting,
  isDisconnecting,
}) {
  const config = PROVIDER_CONFIG[provider];

  // Derive sync status
  function deriveSyncStatus() {
    if (!data?.last_synced_at) return 'synced';
    const elapsed = Date.now() - new Date(data.last_synced_at).getTime();
    if (elapsed < 5 * 60 * 1000) return 'synced';
    return 'synced';
  }

  // Not connected row
  if (!data) {
    return (
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${config.iconBg}`}>
            <CalendarDays className={`h-5 w-5 ${config.iconColor}`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[#0F172A]">{config.label}</span>
            <p className="text-sm text-stone-400">Not connected</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onConnect(provider)}
          disabled={isConnecting}
          aria-label={`Connect ${config.label}`}
        >
          {isConnecting ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Connecting...
            </>
          ) : (
            `Connect ${config.label}`
          )}
        </Button>
      </div>
    );
  }

  // Connected row
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-2 rounded-full ${config.iconBg}`}>
          <CalendarDays className={`h-5 w-5 ${config.iconColor}`} aria-hidden="true" />
        </div>
        <div>
          <span className="text-sm font-semibold text-[#0F172A]">{config.label}</span>
          {data.calendar_name && (
            <p className="text-sm text-[#475569] mt-0.5">{data.calendar_name}</p>
          )}
          {data.last_synced_at && (
            <p className="text-xs text-stone-400 mt-1">
              Last synced:{' '}
              {formatDistanceToNow(new Date(data.last_synced_at), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <SyncStatusDot status={deriveSyncStatus()} />

        {data.is_primary ? (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#C2410C]/10 text-[#C2410C]"
            aria-label="Primary calendar"
          >
            PRIMARY
          </span>
        ) : (
          <button
            className="text-sm text-[#C2410C] hover:underline cursor-pointer"
            aria-label={`Make ${config.label} the primary calendar`}
            onClick={() => onMakePrimary(provider)}
          >
            Make Primary
          </button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              disabled={isDisconnecting}
              aria-label={`Disconnect ${config.label}`}
            >
              {isDisconnecting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
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
    loadStatus().then(() => {
      checkUrlParams();
    });
    return () => {
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

  function checkUrlParams() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const calendarParam = params.get('calendar');

    if (calendarParam === 'connected') {
      toast.success('Google Calendar connected.');
    } else if (calendarParam === 'outlook_connected') {
      toast.success('Outlook Calendar connected.');
    } else if (calendarParam === 'error') {
      setOauthError('google');
    } else if (calendarParam === 'outlook_error') {
      setOauthError('outlook');
    } else if (calendarParam === 'admin_consent') {
      setOauthError('admin_consent');
    }

    // Clean up URL params
    if (calendarParam) {
      window.history.replaceState({}, '', window.location.pathname);
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

  async function handleMakePrimary(provider) {
    const config = PROVIDER_CONFIG[provider];

    // Optimistic UI: immediately swap is_primary
    const prevProviders = { ...providers };
    setProviders((prev) => {
      const updated = { google: null, outlook: null };
      for (const key of ['google', 'outlook']) {
        if (prev[key]) {
          updated[key] = { ...prev[key], is_primary: key === provider };
        }
      }
      return updated;
    });

    try {
      const res = await fetch('/api/calendar-sync/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error('Set primary failed');
      toast.success(`${config.label} set as primary calendar.`);
    } catch {
      // Revert on error
      setProviders(prevProviders);
      toast.error('Could not change primary calendar. Try again.');
    }
  }

  const neitherConnected = !providers.google && !providers.outlook;

  // Loading state
  if (loading) {
    return (
      <section aria-labelledby="calendar-sync-heading" className="mt-6">
        <h2 id="calendar-sync-heading" className="text-xl font-semibold text-[#0F172A] mb-1">
          Calendar Sync
        </h2>
        <p className="text-sm text-[#475569] mb-4">
          Keep your calendar in sync with confirmed bookings.
        </p>
        <div className="h-32 rounded-lg border border-stone-200 animate-pulse bg-[#F5F5F4]" />
      </section>
    );
  }

  return (
    <section aria-labelledby="calendar-sync-heading" className="mt-6">
      <h2 id="calendar-sync-heading" className="text-xl font-semibold text-[#0F172A] mb-1">
        Calendar Sync
      </h2>
      <p className="text-sm text-[#475569] mb-4">
        Keep your calendar in sync with confirmed bookings.
      </p>

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

      {neitherConnected ? (
        /* Empty state (D-07) */
        <div className="rounded-lg border border-dashed border-stone-300 bg-[#F5F5F4] p-6 flex flex-col items-center text-center">
          <div className="p-3 rounded-full bg-white border border-stone-200 mb-3">
            <CalendarDays className="h-6 w-6 text-stone-400" />
          </div>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">No calendar connected</h3>
          <p className="text-sm text-[#475569] mb-4 max-w-xs">
            Connect a calendar to automatically sync bookings.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => handleConnect('google')}
              disabled={connectingProvider === 'google'}
              aria-label="Connect Google Calendar"
            >
              {connectingProvider === 'google' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Google Calendar'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConnect('outlook')}
              disabled={connectingProvider === 'outlook'}
              aria-label="Connect Outlook Calendar"
            >
              {connectingProvider === 'outlook' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Outlook Calendar'
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* One or both connected (D-05) */
        <div className="rounded-lg border border-stone-200 divide-y divide-stone-100">
          <CalendarProviderRow
            provider="google"
            data={providers.google}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onMakePrimary={handleMakePrimary}
            isConnecting={connectingProvider === 'google'}
            isDisconnecting={disconnectingProvider === 'google'}
          />
          <CalendarProviderRow
            provider="outlook"
            data={providers.outlook}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onMakePrimary={handleMakePrimary}
            isConnecting={connectingProvider === 'outlook'}
            isDisconnecting={disconnectingProvider === 'outlook'}
          />
        </div>
      )}
    </section>
  );
}
