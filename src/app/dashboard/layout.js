'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import BottomTabBar from '@/components/dashboard/BottomTabBar';
import dynamic from 'next/dynamic';
const DashboardTour = dynamic(() => import('@/components/dashboard/DashboardTour'), { ssr: false });
import { GridTexture } from '@/components/ui/grid-texture';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import CommandPalette from '@/components/dashboard/CommandPalette';
import ChatbotSheet from '@/components/dashboard/ChatbotSheet';
import SetupChecklistLauncher from '@/components/dashboard/SetupChecklistLauncher';
import { ChatProvider } from '@/components/dashboard/ChatProvider';
import OfflineBanner from '@/components/dashboard/OfflineBanner';
import ImpersonationBanner from './ImpersonationBanner';
import BillingWarningBanner from './BillingWarningBanner';
import TrialCountdownBanner from './TrialCountdownBanner';

function DashboardLayoutInner({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tourRunning, setTourRunning] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const impersonateTenantId = searchParams.get('impersonate');
  const impersonateName = searchParams.get('impersonate_name');

  useEffect(() => {
    function handleStartTour() {
      setTourRunning(true);
    }
    window.addEventListener('start-dashboard-tour', handleStartTour);
    return () => window.removeEventListener('start-dashboard-tour', handleStartTour);
  }, []);

  useEffect(() => {
    function handleOpenChat() { setChatOpen(true); }
    window.addEventListener('open-voco-chat', handleOpenChat);
    return () => window.removeEventListener('open-voco-chat', handleOpenChat);
  }, []);

  return (
    <ChatProvider currentRoute={pathname}>
    <TooltipProvider delayDuration={300}>
      {/* Impersonation banner — outside pointer-events-none wrapper so it stays interactive */}
      {impersonateTenantId && (
        <ImpersonationBanner tenantName={impersonateName || 'Unknown Tenant'} />
      )}

      {/* Main layout — wrapped in pointer-events-none when impersonating to disable all actions */}
      <div className={impersonateTenantId ? 'pointer-events-none opacity-60' : ''}>
        <div className="min-h-screen bg-[#F5F5F4] relative">
          <GridTexture variant="light" />
          <DashboardSidebar />

          <div className="relative lg:pl-60">
            {/* System banners */}
            <OfflineBanner />
            {!impersonateTenantId && <BillingWarningBanner />}
            {!impersonateTenantId && <TrialCountdownBanner />}

            {/* Main content — subtle fade on route change */}
            <AnimatePresence>
              <motion.div
                key={pathname}
                className="max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-6"
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
      </div>
      <CommandPalette />
      <ChatbotSheet open={chatOpen} onOpenChange={setChatOpen} />
      {/* Setup checklist overlay (Plan 48-05 revision) — FAB + responsive Sheet.
          Hidden when the impersonation banner is active so admin sessions
          don't see an owner-facing nudge. */}
      {!impersonateTenantId && <SetupChecklistLauncher />}
      <Toaster richColors position="top-right" />
    </TooltipProvider>
    </ChatProvider>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F5F4]" />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
