'use client';

import { usePathname } from 'next/navigation';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import { GridTexture } from '@/components/ui/grid-texture';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

const BREADCRUMB_LABELS = {
  services: 'Services',
  calendar: 'Calendar',
  settings: 'Settings',
};

function DashboardBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const label = BREADCRUMB_LABELS[lastSegment];

  if (!label || lastSegment === 'dashboard') {
    return (
      <nav className="text-sm text-[#475569]" aria-label="Breadcrumb">
        <span className="text-[#0F172A] font-semibold">Dashboard</span>
      </nav>
    );
  }

  return (
    <nav className="text-sm text-[#475569]" aria-label="Breadcrumb">
      <span>Dashboard</span>
      <span className="mx-2 text-stone-300">&rsaquo;</span>
      <span className="text-[#0F172A] font-semibold">{label}</span>
    </nav>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F5F5F4] relative">
      <GridTexture variant="light" />
      <DashboardSidebar />

      <div className="relative lg:pl-60">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-stone-200/60 px-4 lg:px-8">
          <div className="max-w-6xl mx-auto h-14 flex items-center">
            <div className="lg:hidden w-10" /> {/* Spacer for mobile menu button */}
            <DashboardBreadcrumb />
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6">
          <AnimatedSection>
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-stone-200/60">
              {children}
            </div>
          </AnimatedSection>
        </div>
      </div>
    </div>
  );
}
