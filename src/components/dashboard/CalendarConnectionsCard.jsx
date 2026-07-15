'use client';

import Link from 'next/link';
import { Link2, AlertTriangle, Briefcase } from 'lucide-react';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';
import { card } from '@/lib/design-tokens';
import { INTEGRATIONS_ENABLED } from '@/lib/integrations-enabled';

// Connections card for the calendar page. Replaces the old page-top
// IntegrationReconnectBanner + JobberCopyBanner: calendar providers
// (Google/Outlook) and business apps (Jobber/Xero) now live together in one
// place, with reconnect state surfaced inline instead of as a page banner.
// Polls /api/integrations/status every 60s (+ on focus) so a token failure
// flagged by the backend shows up here without a reload.

const BUSINESS_APPS = [
  {
    key: 'jobber',
    label: 'Jobber',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-[#1B9F4F] dark:text-emerald-400',
  },
  {
    key: 'xero',
    label: 'Xero',
    iconBg: 'bg-sky-50 dark:bg-sky-950/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
];

function BusinessAppRow({ app, row }) {
  const connected = Boolean(row);
  const needsReconnect = row?.error_state === 'token_refresh_failed';

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg ${app.iconBg} shrink-0`}>
            <Briefcase className={`h-4 w-4 ${app.iconColor}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{app.label}</span>
            <p className={`text-xs truncate ${needsReconnect ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {needsReconnect
                ? 'Connection expired — not syncing'
                : connected
                  ? (row.display_name || 'Connected')
                  : 'Not connected'}
            </p>
          </div>
        </div>

        {needsReconnect ? (
          <Link
            href="/dashboard/more/integrations"
            className="shrink-0 inline-flex items-center rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            Reconnect
          </Link>
        ) : connected ? (
          <span
            className="inline-flex items-center gap-1.5 text-sm shrink-0 text-emerald-600 dark:text-emerald-400"
            role="status"
            aria-label={`${app.label} up to date`}
            title="Up to date"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block" />
          </span>
        ) : (
          <Link
            href="/dashboard/more/integrations"
            className="shrink-0 text-xs font-medium text-muted-foreground hover:text-[var(--brand-accent)] transition-colors"
          >
            Connect
          </Link>
        )}
      </div>

      {/* Replaces the dismissible JobberCopyBanner — same message, quieter home. */}
      {app.key === 'jobber' && connected && !needsReconnect && (
        <p className="mt-1.5 pl-9 text-[11px] text-muted-foreground/70 leading-snug">
          Push to Jobber is coming soon — open any booking to copy it across.
        </p>
      )}
    </div>
  );
}

export default function CalendarConnectionsCard() {
  // v1: Jobber/Xero integrations are flagged OFF (see My Prompts/Jobber-Xero-Disable.md).
  // Skip the integrations/status poll (null key = no fetch) and hide the Business
  // apps rows + their "Action needed" badge; the Calendars section stays.
  const { data, isLoading } = useSWRFetch(
    INTEGRATIONS_ENABLED ? '/api/integrations/status' : null,
    { refreshInterval: 60000 },
  );

  const brokenApps = INTEGRATIONS_ENABLED
    ? BUSINESS_APPS.filter(
        (app) => data?.[app.key]?.error_state === 'token_refresh_failed',
      )
    : [];

  return (
    <div className={`${card.base} p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="size-4 text-[var(--accent-sky)]" />
        <h2 className="text-sm font-semibold text-foreground">Connections</h2>
        {brokenApps.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Action needed
          </span>
        )}
      </div>

      {/* Calendars (Google / Outlook). The "Calendars" sub-label only earns its
          keep when the Business apps section renders alongside it. */}
      {INTEGRATIONS_ENABLED && (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-0.5">
          Calendars
        </p>
      )}
      <CalendarSyncCard />

      {/* Business apps (Jobber / Xero) — v1: flagged off, hidden entirely. */}
      {INTEGRATIONS_ENABLED && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-0.5">
            Business apps
          </p>
          {isLoading ? (
            <div className="space-y-3 py-2">
              <div className="h-9 rounded-lg animate-pulse bg-muted" />
              <div className="h-9 rounded-lg animate-pulse bg-muted" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {BUSINESS_APPS.map((app) => (
                <BusinessAppRow key={app.key} app={app} row={data?.[app.key] ?? null} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
