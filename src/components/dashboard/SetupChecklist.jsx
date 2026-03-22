'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import ChecklistItem from '@/components/dashboard/ChecklistItem';
import SetupCompleteBar from '@/components/dashboard/SetupCompleteBar';

// ─── Skeleton shown while loading ────────────────────────────────────────────

function ChecklistSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200/60 p-6 bg-white space-y-4">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-2 w-full" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

// ─── Main checklist component ────────────────────────────────────────────────

export default function SetupChecklist() {
  const [checklistData, setChecklistData] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    fetch('/api/setup-checklist')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setChecklistData(data);
          setDismissed(data.dismissed);
        }
      })
      .catch(() => {});
  }, []);

  // Loading
  if (checklistData === null) {
    return <ChecklistSkeleton />;
  }

  // Already dismissed
  if (dismissed) {
    return null;
  }

  const { items, completedCount } = checklistData;
  const allComplete = completedCount === 6;

  // All complete — show celebration bar
  if (allComplete) {
    async function handleDismiss() {
      setDismissed(true);
      try {
        await fetch('/api/setup-checklist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dismissed: true }),
        });
      } catch { /* best-effort */ }
    }

    return (
      <AnimatePresence>
        {!dismissed && <SetupCompleteBar onDismiss={handleDismiss} />}
      </AnimatePresence>
    );
  }

  // Full checklist
  return (
    <AnimatePresence>
      <motion.div
        initial={prefersReduced ? undefined : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="rounded-2xl border border-stone-200/60 p-6 bg-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Your setup checklist
          </h2>
          <span className="text-sm text-[#475569]">
            {completedCount} of 6 complete
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={(completedCount / 6) * 100}
          className="h-2 mt-3 mb-4 [&>div]:bg-[#C2410C]"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={6}
          aria-label="Setup progress"
        />

        {/* Items */}
        <div>
          {items.map((item) => (
            <ChecklistItem key={item.id} item={item} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
