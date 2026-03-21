'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, BarChart3, Wrench, Calendar, Menu, X, Settings } from 'lucide-react';
import { GridTexture } from '@/components/ui/grid-texture';
import { Separator } from '@/components/ui/separator';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/services', label: 'Services', icon: Wrench },
];

const BOTTOM_NAV = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function NavLink({ item, pathname }) {
  const Icon = item.icon;
  const active = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
        ${active
          ? 'bg-white/[0.06] text-white border-l-2 border-[#C2410C] ml-0 pl-[10px]'
          : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80 border-l-2 border-transparent ml-0 pl-[10px]'
        }
      `}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export default function DashboardSidebar({ businessName }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 h-16 flex items-center gap-2 shrink-0">
        <div className="size-8 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
          </svg>
        </div>
        <span className="text-white font-semibold text-[15px] tracking-tight">
          HomeService AI
        </span>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 flex flex-col">
        <div className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
            />
          ))}
        </div>

        {/* Separator before Settings */}
        <Separator className="bg-white/[0.06] my-2" />

        {/* Bottom nav (Settings) */}
        <div className="space-y-1">
          {BOTTOM_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
            />
          ))}
        </div>
      </nav>

      {/* Business name */}
      {businessName && (
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <p className="text-xs text-white/40 truncate">{businessName}</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col bg-[#0F172A] z-30 overflow-hidden">
        <GridTexture variant="dark" />
        <div className="relative z-10 h-full">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-[#0F172A] text-white shadow-lg"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-60 bg-[#0F172A] z-50 overflow-hidden">
            <GridTexture variant="dark" />
            <div className="relative z-10 h-full">
              <button
                type="button"
                className="absolute top-4 right-4 p-1 text-white/60 hover:text-white"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              <div onClick={() => setMobileOpen(false)}>
                {sidebarContent}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
