'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Phone, MoreHorizontal, Calendar } from 'lucide-react';
import { useAttentionCounts, formatBadgeCount } from '@/hooks/useAttentionCounts';

// Inquiries → Calls merge (2026-06-10): the Inquiries tab is gone — its work
// queue lives inside Calls as the "Needs reply" view, so the freed slot
// re-promotes Calendar (demoted to the More menu in Phase 59 / D-08 to stay
// at the 5-tab mobile safe limit). Calendar also remains reachable via
// More → Business → Calendar.
const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const { callsAttention } = useAttentionCounts();

  // Attention badge: combined "needs you" count on Calls — open inquiries
  // waiting on a reply (Needs reply view) + calls missed today.
  // Hidden at 0; count capped at "9+"; surfaced to AT via the Link aria-label.
  const badges = {
    '/dashboard/calls': {
      count: callsAttention,
      ariaLabel: (n) => `Calls, ${n} need${n === 1 ? 's' : ''} attention`,
    },
  };

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
          const badge = badges[tab.href];
          const badgeCount = badge?.count ?? 0;

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
              aria-label={badgeCount > 0 ? badge.ariaLabel(badgeCount) : undefined}
            >
              <span className="relative">
                <Icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                {badgeCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-accent)] px-1 text-[9px] font-semibold leading-none text-[var(--brand-accent-fg)] tabular-nums"
                  >
                    {formatBadgeCount(badgeCount)}
                  </span>
                )}
              </span>
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
