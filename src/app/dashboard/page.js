'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Phone, AlertCircle, CalendarClock, Users, CalendarCheck, TrendingUp, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { card } from '@/lib/design-tokens';
import { supabase } from '@/lib/supabase-browser';

// ─── Required checklist items for setup completion ────────────────────────────

const REQUIRED_IDS = ['configure_services', 'make_test_call', 'configure_hours'];
const RECOMMENDED_IDS = ['connect_calendar', 'configure_zones', 'setup_escalation', 'configure_notifications'];

// ─── Time formatter ───────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ─── Skeleton shapes ──────────────────────────────────────────────────────────

function HeroSkeleton() {
  return <Skeleton className="h-36 w-full rounded-2xl" />;
}

function CardSkeleton() {
  return <Skeleton className="h-28 w-full rounded-2xl" />;
}

function ActiveModeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-48" />
      <HeroSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

// ─── AI status indicator ──────────────────────────────────────────────────────

function AIStatusIndicator() {
  return (
    <div className="flex items-center gap-2 mb-6">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
      </span>
      <span className="text-sm font-medium text-[#0F172A]">AI Receptionist: Active</span>
    </div>
  );
}

// ─── Dashboard home page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [checklistData, setChecklistData] = useState(undefined); // undefined=loading
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [hasIncompleteRecommended, setHasIncompleteRecommended] = useState(false);
  const [stats, setStats] = useState(null);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [weekStats, setWeekStats] = useState({ leads: 0, booked: 0, conversionRate: 0 });
  const [activities, setActivities] = useState(null);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activeLoading, setActiveLoading] = useState(true);

  // Fetch checklist data at page level to determine setup vs active mode
  useEffect(() => {
    async function loadChecklist() {
      try {
        const res = await fetch('/api/setup-checklist');
        if (res.ok) {
          const data = await res.json();
          setChecklistData(data);
          if (data?.items) {
            const setupComplete = data.items
              .filter((i) => REQUIRED_IDS.includes(i.id))
              .every((i) => i.complete);
            setIsSetupComplete(setupComplete);
            const incompleteRec = data.items
              .filter((i) => RECOMMENDED_IDS.includes(i.id))
              .some((i) => !i.complete);
            setHasIncompleteRecommended(incompleteRec);
          }
        } else {
          setChecklistData(null);
        }
      } catch {
        setChecklistData(null);
      }
    }
    loadChecklist();
  }, []);

  useEffect(() => {
    async function loadActiveData() {
      // Fetch aggregated stats from dedicated endpoint (no 100-lead cap)
      try {
        const statsRes = await fetch('/api/dashboard/stats');
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats({ newLeadsToday: data.newLeadsToday, callsToday: data.callsToday });
          setWeekStats({ leads: data.weekLeads, booked: data.weekBooked, conversionRate: data.conversionRate });
        }
      } catch { /* ignore — stats cards will show 0 */ }

      // Fetch next upcoming appointment
      try {
        const now = new Date().toISOString();
        const weekLater = new Date();
        weekLater.setDate(weekLater.getDate() + 7);
        const apptRes = await fetch(`/api/appointments?start=${now}&end=${weekLater.toISOString()}`);
        if (apptRes.ok) {
          const apptData = await apptRes.json();
          const upcoming = (apptData.appointments || []).find((a) => a.status === 'confirmed');
          setNextAppointment(upcoming || null);
        }
      } catch { /* ignore — card shows "None scheduled" fallback */ }
      setActiveLoading(false);

      // Recent activity from activity_log
      try {
        const { data, error } = await supabase
          .from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error) {
          setActivities(data ?? []);
        } else {
          setActivities([]);
        }
      } catch {
        setActivities([]);
      }
      setActivitiesLoading(false);
    }

    loadActiveData();
  }, []);

  // Tour button visibility (hide if already seen)
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowTour(!localStorage.getItem('gsd_has_seen_tour'));
    }
  }, []);

  // ── Setup mode ──────────────────────────────────────────────────────────────

  const setupMode = checklistData === undefined || !isSetupComplete;

  if (checklistData === undefined) {
    // First paint: show setup skeleton while checklist loads
    return (
      <div className="p-6 space-y-4" data-tour="home-page">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (setupMode) {
    return (
      <div className="p-6 space-y-6" data-tour="home-page">
        {/* AI Status */}
        <AIStatusIndicator />

        {/* Checklist hero */}
        <SetupChecklist />

        {/* Tour button */}
        {showTour && (
          <div className="flex justify-center">
            <button
              type="button"
              data-tour-trigger="true"
              className="text-sm text-[#475569] hover:text-[#0F172A] underline underline-offset-2 transition-colors"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('start-dashboard-tour'));
                  setShowTour(false);
                }
              }}
            >
              Take a quick tour
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Active mode ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4" data-tour="home-page">
      {/* AI Status */}
      <AIStatusIndicator />

      {activeLoading ? (
        <ActiveModeSkeleton />
      ) : (
        <>
          {/* Hero metric — full width */}
          <div className={`${card.base} p-6`} data-tour="hero-metric">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center size-12 rounded-xl bg-[#C2410C]/[0.08]">
                <Phone className="size-5 text-[#C2410C]" />
              </div>
              <div>
                <p className="text-xs font-medium text-[#475569] uppercase tracking-wider">Today</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl lg:text-5xl font-bold text-[#0F172A]">{stats?.callsToday ?? 0}</p>
                  <p className="text-sm text-[#475569]">calls answered</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2-col grid: Action Required + Next Appointment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Action Required card */}
            <Link href="/dashboard/leads" className={`${card.base} ${card.hover} p-5 block`}>
              <div className="flex items-start gap-3">
                <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 ${
                  (stats?.newLeadsToday ?? 0) > 0 ? 'bg-[#C2410C]/[0.08]' : 'bg-stone-100'
                }`}>
                  <AlertCircle className={`size-4.5 ${(stats?.newLeadsToday ?? 0) > 0 ? 'text-[#C2410C]' : 'text-stone-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium uppercase tracking-wider ${(stats?.newLeadsToday ?? 0) > 0 ? 'text-[#C2410C]' : 'text-[#475569]'}`}>
                    {(stats?.newLeadsToday ?? 0) > 0 ? 'Action Required' : 'All Clear'}
                  </p>
                  <p className="text-2xl font-bold text-[#0F172A] mt-0.5">{stats?.newLeadsToday ?? 0}</p>
                  <p className="text-xs text-[#475569]">new leads</p>
                </div>
              </div>
            </Link>

            {/* Next Appointment card */}
            <div className={`${card.base} p-5`}>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg shrink-0 bg-stone-100">
                  <CalendarClock className="size-4.5 text-stone-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#475569] uppercase tracking-wider">Next Appointment</p>
                  {nextAppointment ? (
                    <div className="mt-1">
                      <p className="text-sm font-semibold text-[#0F172A]">{nextAppointment.caller_name || 'Customer'}</p>
                      <p className="text-xs text-[#475569]">{formatTime(nextAppointment.start_time)}{nextAppointment.service_address ? ` — ${nextAppointment.service_address}` : ''}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#475569] mt-1">None scheduled</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* This Week — full width */}
          <div className={`${card.base} p-5`}>
            <p className="text-xs font-medium text-[#475569] uppercase tracking-wider mb-4">This Week</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center justify-center size-8 rounded-lg bg-stone-100">
                  <Users className="size-4 text-stone-500" />
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{weekStats.leads}</p>
                <p className="text-xs text-[#475569]">Leads</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-50">
                  <CalendarCheck className="size-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{weekStats.booked}</p>
                <p className="text-xs text-[#475569]">Booked</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center justify-center size-8 rounded-lg bg-blue-50">
                  <TrendingUp className="size-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">{weekStats.conversionRate}%</p>
                <p className="text-xs text-[#475569]">Conversion</p>
              </div>
            </div>
          </div>

          {/* Setup checklist — shown in active mode when recommended items remain */}
          {hasIncompleteRecommended && <SetupChecklist />}

          {/* Recent Activity — full width, capped at 5 */}
          <div className={`${card.base} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="size-4 text-[#475569]" />
              <h2 className="text-xs font-medium text-[#475569] uppercase tracking-wider">Recent Activity</h2>
            </div>
            <RecentActivityFeed activities={activities?.slice(0, 5)} loading={activitiesLoading} />
          </div>
        </>
      )}
    </div>
  );
}
