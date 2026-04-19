'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useSWRFetch } from '@/hooks/useSWRFetch';

// Surfaces on any page that mounts it whenever an accounting integration
// (Jobber or Xero) has error_state='token_refresh_failed' — set by
// refreshTokenIfNeeded when a webhook or background refresh hits a 401.
// Polls every 30s + revalidates on focus so the banner appears shortly
// after a silent refresh failure, without the owner needing to reload.
export function IntegrationReconnectBanner() {
  const { data } = useSWRFetch('/api/integrations/status', {
    refreshInterval: 30000,
  });

  if (!data) return null;

  const broken = [];
  if (data.jobber?.error_state === 'token_refresh_failed') broken.push('Jobber');
  if (data.xero?.error_state === 'token_refresh_failed') broken.push('Xero');
  if (broken.length === 0) return null;

  const providerLabel =
    broken.length === 1 ? broken[0] : broken.join(' and ');

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40 mb-4"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Reconnect {providerLabel}
        </p>
        <p className="text-sm text-amber-800/90 dark:text-amber-200/90 mt-0.5">
          {providerLabel} {broken.length === 1 ? 'token has' : 'tokens have'} expired, so calendar changes aren&apos;t syncing. Reconnect to resume live updates.
        </p>
      </div>
      <Link
        href="/dashboard/more/integrations"
        className="shrink-0 inline-flex items-center rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60 transition-colors"
      >
        Reconnect
      </Link>
    </div>
  );
}
