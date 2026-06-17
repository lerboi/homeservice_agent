'use client';

/**
 * Dashboard Home — daily command center (Phase 48 HOME-01..HOME-07).
 *
 * Post-revision structure (Plan 48-05 pivot): single-column layout. The
 * setup checklist moved out to the overlay launcher mounted at the layout
 * level (SetupChecklistLauncher — FAB + responsive Sheet). The inline
 * chat panel was removed in favor of the existing ChatbotSheet launched
 * from the sidebar "Ask Voco AI" trigger (window event `open-voco-chat`).
 * Both decisions override D-04 (inline checklist top-of-page) and D-07
 * (right sidebar ChatPanel) from the original plan — see 48-05-SUMMARY
 * Revision section for rationale.
 *
 * Structure:
 *   Greeting (status indicator + "Good {morning|afternoon|evening}")
 *   DailyOpsHub (bento — today's appts, calls, hot leads, usage)
 *   HelpDiscoverabilityCard (quick links to ongoing-ops tasks)
 *   RecentActivityFeed (tertiary context)
 *
 * Legacy surfaces intentionally removed (carried over from Plan 48-05 Task 2):
 *   - setup-mode conditional (completion is server-derived in /api/setup-checklist)
 *   - required / recommended ID arrays (completion logic lives server-side now)
 *   - Inline missed-calls alert block (absorbed into CallsTile)
 *   - Today's schedule inline list (subsumed into TodayAppointmentsTile)
 *
 * Money snapshot: compact strip (Outstanding · Overdue · Paid this month) fed
 * by GET /api/dashboard/stats invoice aggregates, linking to /dashboard/invoices.
 * Gated by the invoicing feature flag (Phase 53 FeatureFlagsProvider).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HelpCircle, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import DailyOpsHub from '@/components/dashboard/DailyOpsHub';
import HelpDiscoverabilityCard from '@/components/dashboard/HelpDiscoverabilityCard';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import AiNumberBanner from '@/components/dashboard/AiNumberBanner';
import { card, focus } from '@/lib/design-tokens';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatMoney(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * MoneySnapshot — compact invoice-money strip linking to /dashboard/invoices.
 * Renders nothing while the invoicing flag is off or stats haven't loaded
 * (SWR key is shared with the bento tiles, so this adds no extra request).
 */
function MoneySnapshot() {
  const { invoicing } = useFeatureFlags();
  const { data } = useSWRFetch(invoicing ? '/api/dashboard/stats' : null);

  if (!invoicing || !data) return null;

  const overdue = data.invoiceOverdueAmount ?? 0;

  return (
    <Link
      href="/dashboard/invoices"
      className={`${card.base} ${card.hover} ${focus.ring} flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3`}
    >
      <span className="font-normal text-sm text-muted-foreground">Outstanding</span>
      <span className="font-semibold text-sm text-foreground tabular-nums">
        {formatMoney(data.invoiceOutstandingAmount)}
      </span>
      <span className="text-muted-foreground" aria-hidden="true">·</span>
      <span className="font-normal text-sm text-muted-foreground">Overdue</span>
      <span
        className={`font-semibold text-sm tabular-nums ${
          overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
        }`}
      >
        {formatMoney(overdue)}
      </span>
      <span className="text-muted-foreground" aria-hidden="true">·</span>
      <span className="font-normal text-sm text-muted-foreground">Paid this month</span>
      <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
        {formatMoney(data.paidThisMonth)}
      </span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

export default function DashboardHomePage() {
  // ─── Recent activity (kept: tertiary context per D-07) ─────────────────
  const [activities, setActivities] = useState(null);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setActivities(error ? [] : data ?? []);
      setActivitiesLoading(false);
    }
    loadActivity();
  }, []);

  // ─── Tour trigger (preserved from prior page) ───────────────────────────
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowTour(!localStorage.getItem('gsd_has_seen_tour'));
    }
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8" data-tour="home-page">
      {/* Greeting + AI status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <div>
            <h1 className="font-semibold text-2xl text-foreground leading-tight">
              {getGreeting()}
            </h1>
            <p className="font-normal text-sm text-muted-foreground leading-normal">
              AI Receptionist is active
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('gsd_has_seen_tour');
              window.dispatchEvent(new CustomEvent('start-dashboard-tour'));
            }
          }}
          aria-label="Take a guided tour"
          className="font-normal text-xs text-muted-foreground hover:text-muted-foreground transition-colors flex items-center gap-1"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {showTour ? 'Take the tour' : 'Tour'}
        </button>
      </div>

      {/* AI receptionist number — surfaces the provisioned Twilio number with a link to Account */}
      <AiNumberBanner />

      {/* Daily ops bento */}
      <DailyOpsHub />

      {/* Invoice money snapshot — gated by the invoicing feature flag */}
      <MoneySnapshot />

      {/* Help & Discoverability quick links */}
      <HelpDiscoverabilityCard />

      {/* Recent activity — tertiary context */}
      <div className={`${card.base} p-5`}>
        <h2 className="font-semibold text-base text-foreground leading-[1.4] mb-4">
          Recent activity
        </h2>
        <RecentActivityFeed
          activities={activities}
          loading={activitiesLoading}
        />
      </div>
    </div>
  );
}
