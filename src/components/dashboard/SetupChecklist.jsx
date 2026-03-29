'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import ChecklistItem from '@/components/dashboard/ChecklistItem';
import SetupCompleteBar from '@/components/dashboard/SetupCompleteBar';

// ─── Item classification (frontend-only, no API change) ──────────────────────

const ITEM_TYPE = {
  configure_services: 'required',
  make_test_call: 'required',
  configure_hours: 'required',
  connect_calendar: 'recommended',
  configure_zones: 'recommended',
  setup_escalation: 'recommended',
  configure_notifications: 'recommended',
};

const ITEM_DESCRIPTION = {
  configure_services: 'AI uses your service list to understand what callers need.',
  make_test_call: 'Hear your AI receptionist answer before going live.',
  configure_hours: 'Set when you are available so AI only books open slots.',
  connect_calendar: 'Sync your calendar so AI books into real availability.',
  configure_zones: 'Define your coverage areas so AI can schedule travel time between jobs.',
  setup_escalation: 'Add contacts who get notified when an emergency call comes in.',
  configure_notifications: 'Choose how you get notified for each type of call outcome.',
};

// ─── Collapsible section accordion ──────────────────────────────────────────

function SectionAccordion({ label, completedCount, totalCount, allDone, defaultOpen, accentColor, items, expandedItemId, onItemToggle, descriptions }) {
  const [open, setOpen] = useState(defaultOpen);
  const prefersReduced = useReducedMotion();

  return (
    <div className="mb-3 last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-1 py-2 group"
        aria-expanded={open}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        <span className={`text-xs font-semibold uppercase tracking-wider ${accentColor}`}>{label}</span>
        <span className="text-xs text-stone-400 ml-auto">{completedCount}/{totalCount}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div>
              {items.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  type={ITEM_TYPE[item.id]}
                  description={descriptions[item.id] ?? ''}
                  expanded={expandedItemId === item.id}
                  onToggle={onItemToggle}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const [expandedItemId, setExpandedItemId] = useState(null);
  const prefersReduced = useReducedMotion();

  const handleItemToggle = useCallback((itemId) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

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

  const requiredAllDone = requiredComplete === requiredItems.length;
  const recommendedAllDone = recommendedComplete === recommendedItems.length;

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

        {/* Required section — collapsible */}
        {requiredItems.length > 0 && (
          <SectionAccordion
            label="Required"
            completedCount={requiredComplete}
            totalCount={requiredItems.length}
            allDone={requiredAllDone}
            defaultOpen={!requiredAllDone}
            accentColor="text-[#C2410C]"
            items={requiredItems}
            expandedItemId={expandedItemId}
            onItemToggle={handleItemToggle}
            descriptions={ITEM_DESCRIPTION}
          />
        )}

        {/* Recommended section — collapsible */}
        {recommendedItems.length > 0 && (
          <SectionAccordion
            label="Recommended"
            completedCount={recommendedComplete}
            totalCount={recommendedItems.length}
            allDone={recommendedAllDone}
            defaultOpen={!recommendedAllDone}
            accentColor="text-stone-400"
            items={recommendedItems}
            expandedItemId={expandedItemId}
            onItemToggle={handleItemToggle}
            descriptions={ITEM_DESCRIPTION}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
