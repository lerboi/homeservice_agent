'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
import { BookOpen, FileSpreadsheet, Receipt, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { card } from '@/lib/design-tokens';
import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';

const ACCOUNTING_PROVIDERS = [
  { id: 'quickbooks', name: 'QuickBooks', icon: BookOpen, connectLabel: 'Connect QuickBooks' },
  { id: 'xero', name: 'Xero', icon: FileSpreadsheet, connectLabel: 'Connect Xero' },
  { id: 'freshbooks', name: 'FreshBooks', icon: Receipt, connectLabel: 'Connect FreshBooks' },
];

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams();

  const [connections, setConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);

  // Show toast from OAuth callback params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      toast.success(`${connected} connected successfully`);
    }
    if (error) {
      const provider = searchParams.get('provider') || 'provider';
      toast.error(`Couldn't connect to ${provider}. Please try again.`);
    }
  }, [searchParams]);

  // Fetch current connection statuses
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/accounting/status');
        if (!res.ok) throw new Error('Failed to fetch');
        const { connections: conns } = await res.json();
        const map = {};
        if (Array.isArray(conns)) {
          conns.forEach((c) => {
            map[c.provider] = c;
          });
        }
        setConnections(map);
      } catch {
        toast.error("Couldn't load integrations. Try refreshing.");
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  async function handleConnect(provider) {
    setConnecting(provider);
    try {
      const res = await fetch(`/api/accounting/${provider}/auth`);
      const { url, error } = await res.json();
      if (error || !url) {
        toast.error(`Couldn't connect to ${provider}. Please try again.`);
        setConnecting(null);
        return;
      }
      window.location.href = url;
    } catch {
      toast.error(`Couldn't connect to ${provider}. Please try again.`);
      setConnecting(null);
    }
  }

  async function handleDisconnect(provider) {
    setDisconnecting(provider);
    try {
      await fetch('/api/accounting/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      setConnections((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    } catch {
      toast.error(`Couldn't disconnect ${provider}. Please try again.`);
    } finally {
      setDisconnecting(null);
      setDisconnectTarget(null);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Integrations</h1>

      {/* Calendar Connections */}
      <h2 className="text-base font-semibold text-foreground mt-8 mb-1">Calendar Connections</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your calendar to automatically sync appointments.
      </p>
      <div className={`${card.base} p-5`}>
        <CalendarSyncCard />
      </div>

      <h2 className="text-base font-semibold text-foreground mt-10 mb-1">Accounting Software</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Connect your accounting software to automatically sync invoices when you send them.
      </p>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${card.base} p-4`}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-28 mb-4" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Provider cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ACCOUNTING_PROVIDERS.map((provider) => {
            const Icon = provider.icon;
            const conn = connections[provider.id];
            const isConnected = !!conn;
            const isConnecting = connecting === provider.id;
            const isDisconnecting = disconnecting === provider.id;

            return (
              <div key={provider.id} className={`${card.base} p-4 flex flex-col`}>
                {/* Header: icon + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center h-8 w-8 bg-muted rounded-lg">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{provider.name}</span>
                </div>

                {/* Connection status */}
                <div className="flex-1 mb-4">
                  {isConnected ? (
                    <>
                      <p className="text-sm text-emerald-600">
                        Connected to {conn.display_name || provider.name}
                      </p>
                      {conn.last_synced_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last synced {relativeTime(conn.last_synced_at)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  )}
                </div>

                {/* Action button */}
                {isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-red-600 text-red-600 hover:bg-red-50"
                    onClick={() => setDisconnectTarget(provider.id)}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect'
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full bg-[var(--brand-accent)] text-white hover:bg-[var(--brand-accent)]/90"
                    onClick={() => handleConnect(provider.id)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      provider.connectLabel
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disconnect confirmation dialog */}
      <AlertDialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {ACCOUNTING_PROVIDERS.find((p) => p.id === disconnectTarget)?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Invoices will no longer sync to{' '}
              {ACCOUNTING_PROVIDERS.find((p) => p.id === disconnectTarget)?.name}. Previously
              synced invoices are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => handleDisconnect(disconnectTarget)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
