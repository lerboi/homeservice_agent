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

function SyncStatusDot({ status }) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
        Up to date
      </span>
    );
  }
  if (status === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-[#C2410C]">
        <span className="w-2 h-2 rounded-full bg-[#C2410C] inline-block animate-pulse" />
        Syncing…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
        Sync error
      </span>
    );
  }
  if (status === 'reauth') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
        Re-authorization required
      </span>
    );
  }
  return null;
}

export default function CalendarSyncCard() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [calendarName, setCalendarName] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncStatus] = useState('synced');
  const [oauthError, setOauthError] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function loadStatus() {
    try {
      const res = await fetch('/api/calendar-sync/status');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setConnected(data.connected);
      if (data.connected) {
        setCalendarName(data.calendar_name);
        setLastSyncedAt(data.last_synced_at);
      }
    } catch {
      // Silently fail — calendar sync is non-critical
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setOauthError(false);
    setConnecting(true);
    try {
      const res = await fetch('/api/google-calendar/auth');
      if (!res.ok) throw new Error('Failed to get auth URL');
      const { url } = await res.json();

      // Open OAuth popup
      const popup = window.open(
        url,
        'google-calendar-auth',
        'width=600,height=700,left=200,top=100'
      );
      popupRef.current = popup;

      // Poll for popup close + connection status
      pollRef.current = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(pollRef.current);
          // Re-check status after popup closes
          await loadStatus();
          setConnecting(false);
        }
      }, 500);
    } catch {
      setOauthError(true);
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/calendar-sync/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Disconnect failed');
      setConnected(false);
      setCalendarName(null);
      setLastSyncedAt(null);
      toast.success('Google Calendar disconnected.');
    } catch {
      toast.error("Couldn't disconnect Google Calendar. Try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <section aria-labelledby="calendar-sync-heading" className="mt-6">
        <h2 id="calendar-sync-heading" className="text-xl font-semibold text-[#0F172A] mb-1">
          Google Calendar Sync
        </h2>
        <p className="text-sm text-[#475569] mb-4">
          Sync appointments with your Google Calendar in real time.
        </p>
        <div className="h-32 rounded-lg border border-stone-200 animate-pulse bg-[#F5F5F4]" />
      </section>
    );
  }

  return (
    <section aria-labelledby="calendar-sync-heading" className="mt-6">
      <h2 id="calendar-sync-heading" className="text-xl font-semibold text-[#0F172A] mb-1">
        Google Calendar Sync
      </h2>
      <p className="text-sm text-[#475569] mb-4">
        Sync appointments with your Google Calendar in real time.
      </p>

      {oauthError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>Google Calendar authorization failed.</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-4 shrink-0"
              onClick={() => {
                setOauthError(false);
                handleConnect();
              }}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {connected ? (
        /* Connected state */
        <div className="rounded-lg border border-stone-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-full bg-emerald-50">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0F172A]">Connected</span>
                  <SyncStatusDot status={syncStatus} />
                </div>
                {calendarName && (
                  <p className="text-sm text-[#475569] mt-0.5">{calendarName}</p>
                )}
                {lastSyncedAt && (
                  <p className="text-xs text-stone-400 mt-1">
                    Last synced:{' '}
                    {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 shrink-0"
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Disconnecting…
                    </>
                  ) : (
                    'Disconnect'
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    New appointments will no longer sync to your Google Calendar. Existing calendar
                    events will not be deleted. You can reconnect at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        /* Disconnected state */
        <div className="rounded-lg border border-dashed border-stone-300 bg-[#F5F5F4] p-6 flex flex-col items-center text-center">
          <div className="p-3 rounded-full bg-white border border-stone-200 mb-3">
            <CalendarDays className="h-6 w-6 text-stone-400" />
          </div>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Connect Google Calendar</h3>
          <p className="text-sm text-[#475569] mb-4 max-w-xs">
            When connected, confirmed bookings are automatically added to your calendar.
          </p>
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {connecting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <CalendarDays className="h-4 w-4 mr-2" />
                Connect Google Calendar
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
