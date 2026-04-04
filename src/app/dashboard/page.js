'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { CalendarDays, Users, FileText, Activity, MapPin, Clock, ChevronRight, Inbox, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { card } from '@/lib/design-tokens';
import { supabase } from '@/lib/supabase-browser';

// ─── Required checklist items for setup completion ────────────────────────────

const REQUIRED_IDS = ['configure_services', 'make_test_call', 'configure_hours'];
const RECOMMENDED_IDS = ['connect_calendar', 'configure_zones', 'setup_escalation', 'configure_notifications'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatCurrency(amount) {
  return '$' + Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

function formatPhone(number) {
  if (!number) return 'Unknown caller';
  const digits = number.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return number;
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function ActiveModeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-52 w-full rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

// ─── Dashboard home page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [checklistData, setChecklistData] = useState(undefined);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [hasIncompleteRecommended, setHasIncompleteRecommended] = useState(false);
  const [stats, setStats] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [activities, setActivities] = useState(null);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activeLoading, setActiveLoading] = useState(true);
  const [missedCalls, setMissedCalls] = useState([]);

  // Fetch checklist data
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

  // Fetch active mode data
  useEffect(() => {
    async function loadActiveData() {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString().split('T')[0];

      const [statsResult, apptResult, activityResult, missedCallsResult] = await Promise.allSettled([
        fetch('/api/dashboard/stats'),
        fetch(`/api/appointments?start=${startOfDay}&end=${endOfDay}`),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20),
        fetch(`/api/calls?booking_outcome=not_attempted&date_from=${yesterdayISO}&limit=10`),
      ]);

      // Stats
      if (statsResult.status === 'fulfilled' && statsResult.value.ok) {
        setStats(await statsResult.value.json());
      }

      // Today's appointments
      if (apptResult.status === 'fulfilled' && apptResult.value.ok) {
        const apptData = await apptResult.value.json();
        const sorted = (apptData.appointments || [])
          .filter((a) => a.status === 'confirmed' || a.status === 'pending')
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        setTodayAppointments(sorted);
        // Cache for offline access
        try { localStorage.setItem('voco_today_appts', JSON.stringify(sorted)); } catch {}
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Offline fallback: load cached appointments
        try {
          const cached = localStorage.getItem('voco_today_appts');
          if (cached) setTodayAppointments(JSON.parse(cached));
        } catch {}
      }
      setActiveLoading(false);

      // Recent activity
      if (activityResult.status === 'fulfilled') {
        const { data, error } = activityResult.value;
        if (!error) setActivities(data ?? []);
        else setActivities([]);
      } else {
        setActivities([]);
      }
      setActivitiesLoading(false);

      // Missed calls (not_attempted, duration >= 15s = real calls that weren't booked)
      if (missedCallsResult.status === 'fulfilled' && missedCallsResult.value.ok) {
        const missedData = await missedCallsResult.value.json();
        const actionable = (missedData.calls || []).filter(
          (c) => (c.duration_seconds ?? 0) >= 15
        );
        setMissedCalls(actionable);
      }
    }

    loadActiveData();
  }, []);

  // Tour button
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowTour(!localStorage.getItem('gsd_has_seen_tour'));
    }
  }, []);

  // ── Setup mode ──────────────────────────────────────────────────────────────

  const setupMode = checklistData === undefined || !isSetupComplete;

  if (checklistData === undefined) {
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
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-[#0F172A]">AI Receptionist: Active</span>
        </div>
        <SetupChecklist />
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

  const appointmentCount = todayAppointments.length;

  return (
    <div className="p-6 space-y-5" data-tour="home-page">
      {/* Section 1: AI Status + Greeting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <div>
            <p className="text-lg font-semibold text-[#0F172A]">
              {getGreeting()}
            </p>
            <p className="text-sm text-[#475569]">
              {activeLoading
                ? 'Loading your day...'
                : appointmentCount > 0
                  ? `You have ${appointmentCount} job${appointmentCount !== 1 ? 's' : ''} today`
                  : 'No jobs scheduled today'
              }
            </p>
          </div>
        </div>
        <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full hidden sm:block">
          AI Active
        </span>
      </div>

      {activeLoading ? (
        <ActiveModeSkeleton />
      ) : (
        <>
          {/* Section 2: Missed Calls Alert (only when there are actionable missed calls) */}
          {missedCalls.length > 0 && (
            <div className={`${card.base} border-l-4 border-l-[#C2410C] overflow-hidden`}>
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <PhoneMissed className="size-4 text-[#C2410C]" />
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  {missedCalls.length} Missed Call{missedCalls.length !== 1 ? 's' : ''} — No Booking
                </h2>
              </div>
              <div className="divide-y divide-stone-100">
                {missedCalls.slice(0, 5).map((mc) => (
                  <div key={mc.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A]">
                        {formatPhone(mc.from_number)}
                      </p>
                      <p className="text-xs text-[#475569]">
                        {relativeTime(mc.created_at)}
                      </p>
                    </div>
                    <a
                      href={`tel:${mc.from_number}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C2410C] text-white hover:bg-[#C2410C]/90 active:scale-95 transition-all shrink-0"
                    >
                      <PhoneOutgoing className="size-3" />
                      Call Back
                    </a>
                  </div>
                ))}
              </div>
              {missedCalls.length > 5 && (
                <div className="px-5 pb-3 pt-1">
                  <Link
                    href="/dashboard/calls?booking_outcome=not_attempted"
                    className="text-xs text-[#C2410C] hover:underline flex items-center gap-0.5"
                  >
                    View all {missedCalls.length} missed calls <ChevronRight className="size-3" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Section 2b: Setup Checklist (if incomplete recommended items) */}
          {hasIncompleteRecommended && <SetupChecklist />}

          {/* Section 3: Today's Schedule */}
          <div className={`${card.base} overflow-hidden`} data-tour="todays-schedule">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-[#C2410C]" />
                <h2 className="text-sm font-semibold text-[#0F172A]">Today&apos;s Schedule</h2>
                {appointmentCount > 0 && (
                  <span className="text-xs font-medium text-[#C2410C] bg-[#C2410C]/[0.08] px-2 py-0.5 rounded-full">
                    {appointmentCount}
                  </span>
                )}
              </div>
              <Link
                href="/dashboard/calendar"
                className="text-xs text-[#475569] hover:text-[#0F172A] transition-colors flex items-center gap-0.5"
              >
                Full calendar <ChevronRight className="size-3" />
              </Link>
            </div>

            {appointmentCount === 0 ? (
              <div className="px-5 pb-5">
                <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-stone-200 rounded-lg">
                  <CalendarDays className="size-8 text-stone-300 mb-2" />
                  <p className="text-sm text-stone-500">No jobs scheduled today</p>
                  <Link
                    href="/dashboard/calendar"
                    className="text-xs text-[#C2410C] hover:underline mt-1"
                  >
                    View calendar
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {todayAppointments.map((appt) => {
                  const isPending = appt.status === 'pending';
                  return (
                    <div
                      key={appt.id}
                      className={`flex items-center gap-3 px-5 py-3 hover:bg-stone-50/50 transition-colors border-l-3 ${
                        isPending ? 'border-l-amber-400' : 'border-l-green-500'
                      }`}
                    >
                      {/* Time */}
                      <div className="w-16 shrink-0 text-right">
                        <p className="text-sm font-semibold text-[#0F172A] tabular-nums">
                          {formatTime(appt.start_time)}
                        </p>
                        {appt.end_time && (
                          <p className="text-[10px] text-stone-400 tabular-nums">
                            {formatTime(appt.end_time)}
                          </p>
                        )}
                      </div>

                      {/* Divider line */}
                      <div className="w-px h-8 bg-stone-200 shrink-0" />

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">
                          {appt.caller_name || 'Customer'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {appt.job_type && (
                            <span className="text-xs text-stone-500">{appt.job_type}</span>
                          )}
                          {(appt.street_name || appt.service_address) && (
                            <span className="flex items-center gap-0.5 text-xs text-stone-400 truncate">
                              <MapPin className="size-3 shrink-0" />
                              {appt.street_name && appt.postal_code
                                ? `${appt.street_name}, ${appt.postal_code}`
                                : appt.service_address}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      {isPending && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                          Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Two-column — Leads Needing Attention + Invoice Snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Leads Needing Attention */}
            <div className={`${card.base} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className={`size-4 ${(stats?.newLeadsCount ?? 0) > 0 ? 'text-[#C2410C]' : 'text-stone-400'}`} />
                  <h2 className="text-sm font-semibold text-[#0F172A]">New Leads</h2>
                  {(stats?.newLeadsCount ?? 0) > 0 && (
                    <span className="text-xs font-medium text-white bg-[#C2410C] px-2 py-0.5 rounded-full">
                      {stats.newLeadsCount}
                    </span>
                  )}
                </div>
              </div>

              {(stats?.newLeadsCount ?? 0) === 0 ? (
                <div className="flex items-center gap-3 py-4 text-center justify-center">
                  <Inbox className="size-5 text-stone-300" />
                  <p className="text-sm text-stone-400">All caught up</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(stats?.newLeadsPreview || []).map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-stone-50/70"
                    >
                      <div className="size-8 rounded-full bg-[#C2410C]/[0.08] flex items-center justify-center shrink-0">
                        <Users className="size-3.5 text-[#C2410C]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">
                          {lead.caller_name || lead.from_number || 'Unknown'}
                        </p>
                        <p className="text-xs text-stone-400 truncate">
                          {lead.job_type || 'No job type'} · {relativeTime(lead.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(stats?.newLeadsCount ?? 0) > 3 && (
                    <Link
                      href="/dashboard/leads?status=new"
                      className="flex items-center justify-center gap-1 text-xs text-[#C2410C] hover:underline pt-1"
                    >
                      View all {stats.newLeadsCount} leads <ChevronRight className="size-3" />
                    </Link>
                  )}
                </div>
              )}

              {(stats?.newLeadsCount ?? 0) > 0 && (stats?.newLeadsCount ?? 0) <= 3 && (
                <Link
                  href="/dashboard/leads"
                  className="flex items-center justify-center gap-1 text-xs text-[#C2410C] hover:underline mt-3"
                >
                  View leads <ChevronRight className="size-3" />
                </Link>
              )}
            </div>

            {/* Invoice Snapshot */}
            <Link href="/dashboard/invoices" className={`${card.base} ${card.hover} p-5 block`}>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="size-4 text-[#C2410C]" />
                <h2 className="text-sm font-semibold text-[#0F172A]">Invoices</h2>
              </div>

              {(stats?.invoiceOutstandingCount ?? 0) > 0 ? (
                <div>
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {formatCurrency(stats.invoiceOutstandingAmount)}
                  </p>
                  <p className="text-xs text-[#475569] mt-1">
                    {stats.invoiceOutstandingCount} outstanding
                  </p>
                  {(stats?.invoiceOverdueCount ?? 0) > 0 && (
                    <p className="text-xs text-red-600 font-medium mt-0.5">
                      {stats.invoiceOverdueCount} overdue
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {formatCurrency(stats?.paidThisMonth)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Collected this month
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Section 5: Recent Activity (trimmed to 3) */}
          <div className={`${card.base} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="size-4 text-[#475569]" />
              <h2 className="text-xs font-medium text-[#475569] uppercase tracking-wider">Recent Activity</h2>
            </div>
            <RecentActivityFeed activities={activities?.slice(0, 3)} loading={activitiesLoading} />
          </div>
        </>
      )}
    </div>
  );
}
