'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, Users, FileText, Calendar, Phone, MoreHorizontal, LogOut, MessageSquare, Sun, Moon, Contact } from 'lucide-react';
import { useTheme } from 'next-themes';
import { GridTexture } from '@/components/ui/grid-texture';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase-browser';
import { getNextTheme, getToggleLabel, getToggleAriaLabel } from '@/lib/theme-toggle-logic';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';
import { useAttentionCounts, formatBadgeCount } from '@/hooks/useAttentionCounts';

// Inquiries → Calls merge (2026-06-10): the Inquiries nav item is gone — its
// work queue lives inside Calls as the "Needs reply" view.
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Users },
  { href: '/dashboard/customers', label: 'Customers', icon: Contact },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
];

function NavLink({ item, pathname, badge }) {
  const Icon = item.icon;
  const active = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);
  const badgeCount = badge?.count ?? 0;

  return (
    <Link
      href={item.href}
      aria-label={badgeCount > 0 ? badge.ariaLabel(badgeCount) : undefined}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
        ${active
          ? 'bg-white/[0.06] text-white border-l-2 border-[var(--brand-accent)] ml-0 pl-[10px]'
          : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80 border-l-2 border-transparent ml-0 pl-[10px]'
        }
      `}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
      {badgeCount > 0 && (
        <span
          aria-hidden="true"
          className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand-accent)] px-1 text-[10px] font-semibold leading-none text-[var(--brand-accent-fg)] tabular-nums"
        >
          {formatBadgeCount(badgeCount)}
        </span>
      )}
    </Link>
  );
}

function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 border-l-2 border-transparent ml-0 pl-[10px] w-full opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      >
        <Moon className="h-4 w-4 shrink-0" />
        Dark mode
      </button>
    );
  }

  const current = resolvedTheme === 'dark' ? 'dark' : 'light';
  const Icon = current === 'dark' ? Sun : Moon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setTheme(getNextTheme(current))}
          aria-label={getToggleAriaLabel(current)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-white/60 hover:bg-white/[0.04] hover:text-white/80 border-l-2 border-transparent ml-0 pl-[10px] w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar-bg)]"
        >
          <Icon className="h-4 w-4 shrink-0" />
          {getToggleLabel(current)}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{getToggleAriaLabel(current)}</TooltipContent>
    </Tooltip>
  );
}

export default function DashboardSidebar() {
  const { invoicing } = useFeatureFlags();
  const pathname = usePathname();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
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

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/auth/signin';
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 h-16 flex items-center shrink-0">
        <Image
          src="/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png"
          alt="Voco"
          width={100}
          height={32}
          className="h-8"
          style={{ width: 'auto', height: 'auto' }}
          priority
        />
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 flex flex-col">
        <div className="flex-1 space-y-1">
          {NAV_ITEMS.filter((item) => item.href !== '/dashboard/invoices' || invoicing).map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              badge={badges[item.href]}
            />
          ))}
        </div>

        {/* Separator before Logout */}
        <Separator className="bg-white/[0.06] my-2" />

        {/* Ask Voco AI */}
        <div className="space-y-1 mb-1">
          <button
            onClick={() => window.dispatchEvent(new Event('open-voco-chat'))}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-white/60 hover:bg-white/[0.04] hover:text-white/80 border-l-2 border-transparent ml-0 pl-[10px] w-full"
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            Ask Voco AI
          </button>
        </div>

        {/* Theme Toggle */}
        <div className="space-y-1 mb-1">
          <ThemeToggleButton />
        </div>

        {/* Logout */}
        <div className="space-y-1">
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-white/60 hover:bg-white/[0.04] hover:text-white/80 border-l-2 border-transparent ml-0 pl-[10px] w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log Out
          </button>
        </div>
      </nav>

    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col bg-[var(--sidebar-bg)] z-30 overflow-hidden"
        data-tour="sidebar-nav"
      >
        <GridTexture variant="dark" />
        <div className="relative z-10 h-full">
          {sidebarContent}
        </div>
      </aside>

      {/* Logout confirmation */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]">
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
