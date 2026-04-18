'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Info, X } from 'lucide-react';

const BANNER_DISMISS_KEY = 'voco_jobber_copy_banner_dismissed';

export function JobberCopyBanner({ jobberConnected }) {
  // Default to dismissed so the banner doesn't flash before localStorage is read.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!jobberConnected) return;
    if (typeof window === 'undefined') return;
    setDismissed(localStorage.getItem(BANNER_DISMISS_KEY) === '1');
  }, [jobberConnected]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, '1');
    } catch {
      // localStorage can throw in incognito + Safari with strict settings — fail silent.
    }
    setDismissed(true);
  };

  if (!jobberConnected || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40 mb-4"
      >
        <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Jobber push is coming soon — Voco bookings stay in Voco until then. Click any booking to copy it into Jobber.
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 ml-auto text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
          onClick={handleDismiss}
          aria-label="Dismiss Jobber notification banner"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
