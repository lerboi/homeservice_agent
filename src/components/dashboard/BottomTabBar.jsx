'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Calendar, Phone, MoreHorizontal } from 'lucide-react';

const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0F172A] border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
      data-tour="bottom-nav"
    >
      <div className="flex">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                relative flex-1 flex flex-col items-center justify-center h-[56px] min-h-[48px] gap-1 text-xs font-medium transition-colors duration-200
                ${active
                  ? 'text-[#C2410C]'
                  : 'text-white/60 hover:text-white/80'
                }
              `}
            >
              {active && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute top-0 inset-x-3 h-[2px] bg-[#C2410C] rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
