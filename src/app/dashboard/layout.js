'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Home page — just show "Home"
  if (segments.length <= 1) {
    return (
      <nav className="text-sm text-[#475569]" aria-label="Breadcrumb">
        <span className="text-[#0F172A] font-semibold">Home</span>
      </nav>
    );
  }

  const crumbs = segments.slice(1); // remove 'dashboard'

  // Single segment like /dashboard/leads → just show "Leads" (no parent)
  if (crumbs.length === 1) {
    const label = BREADCRUMB_LABELS[crumbs[0]] || crumbs[0];
    return (
      <nav className="text-sm text-[#475569]" aria-label="Breadcrumb">
        <AnimatePresence mode="wait">
          <motion.span
            key={crumbs[0]}
            className="text-[#0F172A] font-semibold"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </nav>
    );
  }

  // Nested like /dashboard/more/working-hours → "More › Working Hours" (clickable parent)
  return (
    <nav className="text-sm text-[#475569] flex items-center" aria-label="Breadcrumb">
      <AnimatePresence mode="wait">
        <motion.span
          key={pathname}
          className="flex items-center"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {crumbs.map((seg, i) => {
            const label = BREADCRUMB_LABELS[seg];
            if (!label) return null;
            const isLast = i === crumbs.length - 1;
            // Build href for this crumb: /dashboard + all segments up to and including this one
            const href = '/dashboard/' + crumbs.slice(0, i + 1).join('/');

            return (
              <span key={seg} className="flex items-center">
                {i > 0 && <span className="mx-2 text-stone-300">&rsaquo;</span>}
                {isLast ? (
                  <span className="text-[#0F172A] font-semibold">{label}</span>
                ) : (
                  <Link
                    href={href}
                    className="text-[#475569] hover:text-[#0F172A] transition-colors"
                  >
                    {label}
                  </Link>
                )}
              </span>
            );
          })}
        </motion.span>
      </AnimatePresence>
    </nav>
  );
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
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

        {/* Main content — subtle fade on route change */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            className="max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-[72px] lg:pb-6"
            data-tour="dashboard-layout"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>

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
