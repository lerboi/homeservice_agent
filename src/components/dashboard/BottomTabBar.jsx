'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, Phone, BarChart3, MoreHorizontal } from 'lucide-react';

const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Floating hamburger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="lg:hidden fixed top-5 right-5 z-50 flex items-center justify-center size-14 rounded-full bg-[#0F172A]/90 backdrop-blur-[2px] shadow-[0_2px_12px_rgba(0,0,0,0.2)] border border-white/[0.08] active:scale-95 transition-transform duration-150"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        data-tour="bottom-nav"
      >
        {/* Animated hamburger → X */}
        <div className="relative size-5">
          <span
            className={`absolute left-0 block w-5 h-[2px] bg-white rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? 'top-[9px] rotate-45' : 'top-[2px] rotate-0'
            }`}
          />
          <span
            className={`absolute left-0 top-[9px] block w-5 h-[2px] bg-white rounded-full transition-opacity duration-200 ${
              open ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`absolute left-0 block w-5 h-[2px] bg-white rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? 'top-[9px] -rotate-45' : 'top-[16px] rotate-0'
            }`}
          />
        </div>
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-in drawer from right */}
      <nav
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-40 w-72 bg-[#0F172A] flex flex-col
          transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-label="Main navigation"
      >
        {/* Header — clears the floating button */}
        <div className="h-24 shrink-0 flex items-end px-6 pb-5 border-b border-white/[0.06]">
          <span className="text-base font-semibold text-white">Menu</span>
        </div>

        {/* Nav items */}
        <div className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-colors ${
                  active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {active && (
                  <span className="w-1 h-5 rounded-full bg-[#C2410C] shrink-0" aria-hidden="true" />
                )}
                <Icon className="size-[22px] shrink-0" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
