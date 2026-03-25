'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import BottomTabBar from '@/components/dashboard/BottomTabBar';
import DashboardTour from '@/components/dashboard/DashboardTour';
import { GridTexture } from '@/components/ui/grid-texture';

const BREADCRUMB_LABELS = {
  leads: 'Leads',
  calendar: 'Calendar',
  analytics: 'Analytics',
  more: 'More',
  'services-pricing': 'Services & Pricing',
  'working-hours': 'Working Hours',
  'calendar-connections': 'Calendar Connections',
  'service-zones': 'Service Zones & Travel',
  'escalation-contacts': 'Escalation Contacts',
  'ai-voice-settings': 'AI & Voice Settings',
  'account': 'Account',
};

function DashboardBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  // segments: ['dashboard'] or ['dashboard', 'leads'] or ['dashboard', 'more', 'services-pricing']

  if (segments.length <= 1) {
    return (
      <nav className="text-sm text-[#475569]" aria-label="Breadcrumb">
        <span className="text-[#0F172A] font-semibold">Dashboard</span>
      </nav>
    );
  }

  const crumbs = segments.slice(1); // remove 'dashboard'
  return (
    <nav className="text-sm text-[#475569]" aria-label="Breadcrumb">
      <span>Dashboard</span>
      {crumbs.map((seg, i) => {
        const label = BREADCRUMB_LABELS[seg];
        if (!label) return null;
        const isLast = i === crumbs.length - 1;
        return (
          <span key={seg}>
            <span className="mx-2 text-stone-300">&rsaquo;</span>
            <span className={isLast ? 'text-[#0F172A] font-semibold' : ''}>{label}</span>
          </span>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({ children }) {
  const [tourRunning, setTourRunning] = useState(false);

  useEffect(() => {
    function handleStartTour() {
      setTourRunning(true);
    }
    window.addEventListener('start-dashboard-tour', handleStartTour);
    return () => window.removeEventListener('start-dashboard-tour', handleStartTour);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F4] relative">
      <GridTexture variant="light" />
      <DashboardSidebar />

      <div className="relative lg:pl-60">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-stone-200/60 px-4 lg:px-8">
          <div className="max-w-6xl mx-auto h-14 flex items-center justify-between">
            <div className="lg:hidden w-10" /> {/* Spacer for mobile layout */}
            <DashboardBreadcrumb />
            {/* Mobile settings gear icon — links to More hub (D-10) */}
            <Link href="/dashboard/more" className="lg:hidden p-2 text-stone-500 hover:text-[#0F172A]">
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Main content — no card wrapper; each page controls its own card styling */}
        <div
          className="max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-[72px] lg:pb-6"
          data-tour="dashboard-layout"
        >
          {children}
        </div>

        {/* Bottom tab bar — mobile only */}
        <BottomTabBar />
      </div>

      {/* Guided tour — mounted at layout level to persist across tab navigation */}
      <DashboardTour
        run={tourRunning}
        onFinish={() => setTourRunning(false)}
      />
    </div>
  );
}
