'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import ChecklistItem from '@/components/dashboard/ChecklistItem';
import SetupCompleteBar from '@/components/dashboard/SetupCompleteBar';

// ─── Item classification (frontend-only, no API change) ──────────────────────

const ITEM_TYPE = {
  create_account: 'required',
  setup_profile: 'required',
  configure_services: 'required',
  make_test_call: 'required',
  connect_calendar: 'recommended',
  configure_hours: 'recommended',
};

const ITEM_DESCRIPTION = {
  create_account: 'Your account is set up and ready to go.',
  setup_profile: 'Your business name is how AI greets callers.',
  configure_services: 'AI uses your service list to understand what callers need.',
  make_test_call: 'Hear your AI receptionist answer before going live.',
  connect_calendar: 'Sync your calendar so AI books into real availability.',
  configure_hours: 'Set when you are available so AI only books open slots.',
};

// ─── Progress ring (conic-gradient) ──────────────────────────────────────────

function ProgressRing({ requiredComplete, requiredTotal, recommendedComplete, recommendedTotal }) {
  const total = requiredTotal + recommendedTotal;
  const requiredPct = total > 0 ? (requiredComplete / total) * 100 : 0;
  const recommendedPct = total > 0 ? (recommendedComplete / total) * 100 : 0;
  const totalPct = requiredPct + recommendedPct;
  const completed = requiredComplete + recommendedComplete;

  const style = {
    background: `conic-gradient(
      #C2410C 0% ${requiredPct}%,
      #78716C ${requiredPct}% ${totalPct}%,
      #E7E5E4 ${totalPct}% 100%
    )`,
  };

  return (
    <div className="relative h-16 w-16 rounded-full shrink-0" style={style}>
      <div className="absolute inset-[5px] rounded-full bg-white flex items-center justify-center">
        <span className="text-xs font-semibold text-[#0F172A]">{completed}/{total}</span>
      </div>
    </div>
  );
}

// ─── Skeleton shown while loading ────────────────────────────────────────────

function ChecklistSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200/60 p-6 bg-white space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

// ─── Main checklist component ────────────────────────────────────────────────

/**
 * SetupChecklist — Redesigned checklist with required/recommended split and progress ring.
 *
 * @param {{ onDataLoaded?: (data: object) => void }} props
 */
export default function SetupChecklist({ onDataLoaded }) {
  const [checklistData, setChecklistData] = useState(undefined); // undefined=loading, null=error/hidden
  const [dismissed, setDismissed] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    fetch('/api/setup-checklist')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setChecklistData(data);
          setDismissed(data.dismissed);
          onDataLoaded?.(data);
        } else {
          setChecklistData(null);
          onDataLoaded?.(null);
        }
      })
      .catch(() => {
        setChecklistData(null);
        onDataLoaded?.(null);
      });
  }, [onDataLoaded]);

  // Loading
  if (checklistData === undefined) {
    return <ChecklistSkeleton />;
  }

  // Error or no data — hide checklist
  if (checklistData === null) {
    return null;
  }

  // Already dismissed
  if (dismissed) {
    return null;
  }

  const { items, completedCount } = checklistData;
  const total = items.length;
  const allComplete = completedCount === total;

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

  // Partition items into required and recommended groups
  const requiredItems = items.filter((i) => ITEM_TYPE[i.id] === 'required');
  const recommendedItems = items.filter((i) => ITEM_TYPE[i.id] === 'recommended');

  const requiredComplete = requiredItems.filter((i) => i.complete).length;
  const recommendedComplete = recommendedItems.filter((i) => i.complete).length;

  // Full checklist
  return (
    <AnimatePresence>
      <motion.div
        initial={prefersReduced ? undefined : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="rounded-2xl border border-stone-200/60 p-6 bg-white"
      >
        {/* Header: progress ring + title */}
        <div className="flex items-center gap-4 mb-5">
          <ProgressRing
            requiredComplete={requiredComplete}
            requiredTotal={requiredItems.length}
            recommendedComplete={recommendedComplete}
            recommendedTotal={recommendedItems.length}
          />
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">Your setup checklist</h2>
            <p className="text-sm text-[#475569] mt-0.5">{completedCount} of {total} complete</p>
          </div>
        </div>

        {/* Required items */}
        {requiredItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C] mb-2 px-1">Required</p>
            <div>
              {requiredItems.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  type="required"
                  description={ITEM_DESCRIPTION[item.id] ?? ''}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recommended items */}
        {recommendedItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2 px-1">Recommended</p>
            <div>
              {recommendedItems.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  type="recommended"
                  description={ITEM_DESCRIPTION[item.id] ?? ''}
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
