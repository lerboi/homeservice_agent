'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardHomeStats from '@/components/dashboard/DashboardHomeStats';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { supabase } from '@/lib/supabase-browser';

// ─── Stats skeleton ───────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─── Dashboard home page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // ── Fetch stats in parallel ──────────────────────────────────────────
      const today = new Date().toISOString().split('T')[0];

      const [leadsRes, allLeadsRes, appointmentsRes] = await Promise.allSettled([
        // New leads today
        fetch(`/api/leads?status=new&date_from=${today}`),
        // All leads for conversion rate
        fetch('/api/leads'),
        // Upcoming appointments today
        fetch(`/api/appointments?date=${today}&days=1`),
      ]);

      // ── Process new leads today ──────────────────────────────────────────
      let newLeadsToday = 0;
      if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
        try {
          const data = await leadsRes.value.json();
          newLeadsToday = (data.leads ?? []).length;
        } catch { /* ignore */ }
      }

      // ── Process conversion rate ──────────────────────────────────────────
      let conversionRate = 0;
      let callsToday = 0;
      if (allLeadsRes.status === 'fulfilled' && allLeadsRes.value.ok) {
        try {
          const data = await allLeadsRes.value.json();
          const allLeads = data.leads ?? [];
          const total = allLeads.length;
          const converted = allLeads.filter(
            (l) => l.status === 'completed' || l.status === 'paid'
          ).length;
          conversionRate = total > 0 ? (converted / total) * 100 : 0;

          // Calls today — leads created today
          callsToday = allLeads.filter((l) => {
            const created = l.created_at?.split('T')[0];
            return created === today;
          }).length;
        } catch { /* ignore */ }
      }

      // ── Process upcoming appointments ────────────────────────────────────
      let upcomingAppointments = 0;
      if (appointmentsRes.status === 'fulfilled' && appointmentsRes.value.ok) {
        try {
          const data = await appointmentsRes.value.json();
          upcomingAppointments = (data.appointments ?? data.slots ?? []).length;
        } catch { /* ignore */ }
      }

      setStats({ newLeadsToday, upcomingAppointments, callsToday, conversionRate });
      setStatsLoading(false);

      // ── Fetch recent activity from activity_log (RLS filters by tenant) ─
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

    load();
  }, []);

  return (
    <div className="p-6 space-y-8">
      {/* ── Stats section ───────────────────────────────────────────────── */}
      <section aria-label="Today's summary">
        {statsLoading ? (
          <StatsSkeleton />
        ) : (
          <DashboardHomeStats stats={stats} />
        )}
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="border-t border-stone-100" />

      {/* ── Recent activity section ──────────────────────────────────────── */}
      <section aria-label="Recent activity">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-5">
          Recent Activity
        </h2>
        <RecentActivityFeed
          activities={activities}
          loading={activitiesLoading}
        />
      </section>
    </div>
  );
}
