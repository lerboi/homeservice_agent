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
 *   - Invoice snapshot card (dropped — /dashboard/more/billing owns that data)
 */

import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import DailyOpsHub from '@/components/dashboard/DailyOpsHub';
import HelpDiscoverabilityCard from '@/components/dashboard/HelpDiscoverabilityCard';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { card } from '@/lib/design-tokens';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
            <h1 className="font-semibold text-2xl text-[#0F172A] leading-tight">
              {getGreeting()}
            </h1>
            <p className="font-normal text-sm text-[#475569] leading-normal">
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
          className="font-normal text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {showTour ? 'Take the tour' : 'Tour'}
        </button>
      </div>

      {/* Daily ops bento */}
      <DailyOpsHub />

      {/* Help & Discoverability quick links */}
      <HelpDiscoverabilityCard />

      {/* Recent activity — tertiary context */}
      <div className={`${card.base} p-5`}>
        <h2 className="font-semibold text-base text-[#0F172A] leading-[1.4] mb-4">
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
