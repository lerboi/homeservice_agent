'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { card } from '@/lib/design-tokens';
import { supabase } from '@/lib/supabase-browser';

// ─── Required checklist items for setup completion ────────────────────────────

const REQUIRED_IDS = ['create_account', 'setup_profile', 'configure_services', 'make_test_call'];

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
      const today = new Date().toISOString().split('T')[0];

      // Fetch leads data for stats (appointments API does not exist yet — skip gracefully)
      const [leadsRes, allLeadsRes] = await Promise.allSettled([
        fetch(`/api/leads?status=new&date_from=${today}`),
        fetch('/api/leads'),
      ]);

      // New leads today (action-required card)
      let newLeadsToday = 0;
      if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
        try {
          const data = await leadsRes.value.json();
          newLeadsToday = (data.leads ?? []).length;
        } catch { /* ignore */ }
      }

      // All-time leads for calls today + week stats
      let callsToday = 0;
      let weekLeads = 0;
      let weekBooked = 0;
      if (allLeadsRes.status === 'fulfilled' && allLeadsRes.value.ok) {
        try {
          const data = await allLeadsRes.value.json();
          const allLeads = data.leads ?? [];

          callsToday = allLeads.filter((l) => {
            const created = l.created_at?.split('T')[0];
            return created === today;
          }).length;

          // Week stats: last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const weekLeadList = allLeads.filter((l) => {
            if (!l.created_at) return false;
            return new Date(l.created_at) >= sevenDaysAgo;
          });
          weekLeads = weekLeadList.length;
          weekBooked = weekLeadList.filter((l) => l.status === 'booked' || l.status === 'completed' || l.status === 'paid').length;
        } catch { /* ignore */ }
      }

      const conversionRate = weekLeads > 0 ? Math.round((weekBooked / weekLeads) * 100) : 0;

      setStats({ newLeadsToday, callsToday });
      setWeekStats({ leads: weekLeads, booked: weekBooked, conversionRate });
      setNextAppointment(null); // appointments API not yet available
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
            <p className="text-sm text-[#475569] mb-1">Today</p>
            <p className="text-4xl lg:text-5xl font-bold text-[#0F172A]">{stats?.callsToday ?? 0}</p>
            <p className="text-base text-[#475569] mt-1">calls answered by AI</p>
          </div>

          {/* 2-col grid: Action Required + Next Appointment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Action Required card */}
            <div className={`${card.base} ${card.hover} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-600">Action Required</p>
                  <p className="text-2xl font-bold text-[#0F172A]">{stats?.newLeadsToday ?? 0}</p>
                  <p className="text-sm text-[#475569]">new leads need response</p>
                </div>
                <Link href="/dashboard/leads" className="text-sm font-medium text-[#C2410C] hover:underline">
                  View Leads →
                </Link>
              </div>
            </div>

            {/* Next Appointment card */}
            <div className={`${card.base} p-5`}>
              <p className="text-sm font-semibold text-[#0F172A] mb-2">Next Appointment</p>
              {nextAppointment ? (
                <div>
                  <p className="text-base font-medium text-[#0F172A]">{nextAppointment.customer_name || 'Customer'}</p>
                  <p className="text-sm text-[#475569]">{formatTime(nextAppointment.start_time)} — {nextAppointment.service_type || 'Service'}</p>
                  {nextAppointment.address && <p className="text-sm text-[#475569] mt-1">{nextAppointment.address}</p>}
                </div>
              ) : (
                <p className="text-sm text-[#475569]">No upcoming appointments</p>
              )}
            </div>
          </div>

          {/* This Week — full width */}
          <div className={`${card.base} p-5`}>
            <p className="text-sm font-semibold text-[#0F172A] mb-3">This Week</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-[#0F172A]">{weekStats.leads}</p>
                <p className="text-xs text-[#475569]">Leads</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0F172A]">{weekStats.booked}</p>
                <p className="text-xs text-[#475569]">Booked</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0F172A]">{weekStats.conversionRate}%</p>
                <p className="text-xs text-[#475569]">Conversion</p>
              </div>
            </div>
          </div>

          {/* Recent Activity — full width, capped at 5 */}
          <div className={`${card.base} p-5`}>
            <h2 className="text-base font-semibold text-[#0F172A] mb-4">Recent Activity</h2>
            <RecentActivityFeed activities={activities?.slice(0, 5)} loading={activitiesLoading} />
          </div>
        </>
      )}
    </div>
  );
}
