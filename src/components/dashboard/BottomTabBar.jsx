'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Phone, MoreHorizontal, PhoneIncoming } from 'lucide-react';

// Phase 59 Plan 06 (D-08): Added Inquiries tab. Previous tab count was 5.
// Adding a 6th tab would exceed the mobile safe limit (5 visible max).
// Demoted tab: Calendar (href: /dashboard/calendar, icon: Calendar).
// Reason: Calendar is the lowest-frequency tap for a typical service owner
// (owners view Jobs + Inquiries daily; Calendar is a planning tool accessed
// less often). Calendar remains accessible via More → Calendar in the sidebar.
// Decision recorded in 59-06-SUMMARY.md §BottomTabBar demotion.
const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Users },
  { href: '/dashboard/inquiries', label: 'Inquiries', icon: PhoneIncoming },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-bottom"
      aria-label="Main navigation"
      data-tour="bottom-nav"
    >
      <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 gap-0.5 min-w-0 transition-colors ${
                active
                  ? 'text-[var(--brand-accent)]'
                  : 'text-muted-foreground active:text-foreground'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-[10px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
