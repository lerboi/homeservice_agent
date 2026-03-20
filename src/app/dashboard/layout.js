'use client';

import { usePathname } from 'next/navigation';

const BREADCRUMB_LABELS = {
  services: 'Services',
  calendar: 'Calendar',
  settings: 'Settings',
};

function DashboardBreadcrumb() {
  const pathname = usePathname();
  // Extract the last path segment: /dashboard/services -> services
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const label = BREADCRUMB_LABELS[lastSegment];

  // On root /dashboard — show just "Dashboard"
  if (!label || lastSegment === 'dashboard') {
    return (
      <nav className="mb-6 text-sm text-slate-500" aria-label="Breadcrumb">
        <span className="text-slate-900 font-semibold">Dashboard</span>
      </nav>
    );
  }

  return (
    <nav className="mb-6 text-sm text-slate-500" aria-label="Breadcrumb">
      <span>Dashboard</span>
      <span className="mx-2 text-slate-300">&rsaquo;</span>
      <span className="text-slate-900 font-semibold">{label}</span>
    </nav>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <DashboardBreadcrumb />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {children}
        </div>
      </div>
    </div>
  );
}
