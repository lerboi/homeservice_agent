'use client';

import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import AnalyticsCharts from '@/components/dashboard/AnalyticsCharts';
import { EmptyStateAnalytics } from '@/components/dashboard/EmptyStateAnalytics';
import { card } from '@/lib/design-tokens';

export default function AnalyticsPage() {
  const [leads, setLeads] = useState(null);
  const [calls, setCalls] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const since = new Date(Date.now() - 90 * 86400000).toISOString();
        const [leadsRes, callsRes] = await Promise.all([
          fetch(`/api/leads?date_from=${since}&limit=0`),
          fetch(`/api/calls?dateFrom=${since}&limit=500`),
        ]);
        const leadsData = leadsRes.ok ? await leadsRes.json() : { leads: [] };
        const callsData = callsRes.ok ? await callsRes.json() : { calls: [] };
        setLeads(leadsData.leads ?? []);
        setCalls(callsData.calls ?? []);
      } catch {
        setLeads([]);
        setCalls([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className={`${card.base} p-0`} data-tour="analytics-page">
      <div className="p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center size-8 rounded-lg bg-stone-100">
            <BarChart3 className="size-4 text-stone-500" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        </div>
        {!loading && (!leads || leads.length === 0) && (!calls || calls.length === 0) ? (
          <EmptyStateAnalytics />
        ) : (
          <AnalyticsCharts leads={leads} calls={calls} loading={loading} />
        )}
      </div>
    </div>
  );
}
