'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, Users, FileText, Calendar, Phone, MoreHorizontal, LogOut, Ellipsis, ClipboardList } from 'lucide-react';
import { GridTexture } from '@/components/ui/grid-texture';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase-browser';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
  { href: '/dashboard/estimates', label: 'Estimates', icon: ClipboardList },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
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
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

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
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
            />
          ))}
        </div>

        {/* Separator before Logout */}
        <Separator className="bg-white/[0.06] my-2" />

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
      <aside
        className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col bg-[#0F172A] z-30 overflow-hidden"
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
            <AlertDialogAction onClick={handleLogout} className="bg-[#C2410C] hover:bg-[#B53B0A]">
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
