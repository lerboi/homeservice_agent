'use client';

import { useState, useEffect } from 'react';
import AnalyticsCharts from '@/components/dashboard/AnalyticsCharts';
import { EmptyStateAnalytics } from '@/components/dashboard/EmptyStateAnalytics';
import { card } from '@/lib/design-tokens';

export default function AnalyticsPage() {
  const [leads, setLeads] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeads() {
      try {
        const res = await fetch('/api/leads');
        if (!res.ok) throw new Error('Failed to load leads');
        const data = await res.json();
        setLeads(data.leads ?? []);
      } catch {
        setLeads([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, []);

  return (
    <div className={`${card.base} p-0`} data-tour="analytics-page">
      <div className="p-6">
        <h1 className="text-xl font-semibold text-[#0F172A] mb-6">Analytics</h1>
        {!loading && leads && leads.length === 0 ? (
          <EmptyStateAnalytics />
        ) : (
          <AnalyticsCharts leads={leads} loading={loading} />
        )}
      </div>
    </div>
  );
}
