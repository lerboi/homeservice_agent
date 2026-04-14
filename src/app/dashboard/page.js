'use client';

/**
 * Dashboard Home — daily command center (Phase 48 HOME-01..HOME-07).
 *
 * Structure (UI-SPEC Layout Contract):
 *   Greeting (status indicator + "Good {morning|afternoon|evening}")
 *   SetupChecklist (full width, themed accordions — Plan 48-03)
 *   12-col responsive grid
 *     lg: main col-span-8 (DailyOpsHub then Help+Activity) + sticky col-span-4 ChatPanel
 *     < lg: single column in D-16 mobile stack order
 *
 * Legacy surfaces intentionally removed per D-07:
 *   - setup-mode conditional (completion is server-derived in /api/setup-checklist)
 *   - required / recommended ID arrays (completion logic lives server-side now)
 *   - Inline missed-calls alert block (absorbed into CallsTile)
 *   - Today's schedule inline list (subsumed into TodayAppointmentsTile)
 *   - Invoice snapshot card (dropped — /dashboard/more/billing owns that data)
 */

import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import DailyOpsHub from '@/components/dashboard/DailyOpsHub';
import ChatPanel from '@/components/dashboard/ChatPanel';
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
    <div className="space-y-8" data-tour="home-page">
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

      {/* Setup checklist — full width */}
      <SetupChecklist />

      {/* Main hub + sticky chat sidebar (lg+) — single-column mobile stack otherwise */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left column, top row — Daily ops bento */}
        <div className="order-1 lg:col-span-8 lg:order-1 space-y-4 lg:space-y-8">
          <DailyOpsHub />
        </div>

        {/* Right sidebar — sticky on lg+, stacks to bottom on mobile per D-16 */}
        <aside className="order-3 lg:col-span-4 lg:order-2 lg:row-span-2">
          <div className="lg:sticky lg:top-6">
            <ChatPanel />
          </div>
        </aside>

        {/* Left column, bottom row — Help + Activity */}
        <div className="order-2 lg:col-span-8 lg:order-3 space-y-4 lg:space-y-8">
          <HelpDiscoverabilityCard />
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
      </div>
    </div>
  );
}
