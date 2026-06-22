'use client';

import { useCallback, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import ChecklistItem from '@/components/dashboard/ChecklistItem';
import SetupCompleteBar from '@/components/dashboard/SetupCompleteBar';
import { useSWRFetch } from '@/hooks/useSWRFetch';

// ─── Tier group metadata (onboarding revamp) ─────────────────────────────────
// The checklist groups by call-readiness TIER, not by settings theme. ESSENTIAL
// items gate "can my AI take and book calls properly?"; RECOMMENDED improve
// handling; OPTIONAL are integrations. Mirrors TIER_ORDER in the API route.
const TIER_ORDER = ['essential', 'recommended', 'optional'];
const TIER_LABELS = {
  essential: 'Essential',
  recommended: 'Recommended',
  optional: 'Optional',
};
const TIER_SUBLABELS = {
  essential: 'Needed before your AI can take and book calls',
  recommended: 'Make your AI handle calls even better',
  optional: 'Connect tools you already use',
};

// ─── Progress ring (conic-gradient) ──────────────────────────────────────────

function ProgressRing({ completed, total }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;

  const style = {
    background: `conic-gradient(
      var(--accent-emerald) 0% ${pct}%,
      hsl(var(--muted)) ${pct}% 100%
    )`,
  };

  return (
    <div className="relative h-16 w-16 rounded-full shrink-0" style={style}>
      <div className="absolute inset-[5px] rounded-full bg-card flex items-center justify-center">
        <span className="text-xs font-semibold text-foreground tabular-nums">
          {completed}/{total}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton shown while loading ────────────────────────────────────────────

function ChecklistSkeleton() {
  return (
    <div className="rounded-2xl border border-border p-6 bg-card space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

// ─── Main checklist component ────────────────────────────────────────────────

export default function SetupChecklist({ onDataLoaded }) {
  const prefersReduced = useReducedMotion();

  const { data, error, isLoading, mutate } = useSWRFetch('/api/setup-checklist', {
    revalidateOnFocus: true,
    onSuccess: (payload) => {
      onDataLoaded?.(payload);
    },
  });

  const handleMarkDone = useCallback(
    async (itemId, nextValue) => {
      await mutate(
        (current) => {
          if (!current || !Array.isArray(current.items)) return current;
          const nextItems = current.items.map((it) =>
            it.id === itemId
              ? { ...it, complete: nextValue, mark_done_override: nextValue }
              : it
          );
          const completeCount = nextItems.filter((i) => i.complete).length;
          return {
            ...current,
            items: nextItems,
            completedCount: completeCount,
            progress: {
              ...(current.progress || {}),
              total: nextItems.length,
              complete: completeCount,
              percent:
                nextItems.length > 0
                  ? Math.round((completeCount / nextItems.length) * 100)
                  : 0,
            },
          };
        },
        { revalidate: false }
      );

      try {
        const res = await fetch('/api/setup-checklist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, mark_done: nextValue }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await mutate();
      } catch {
        await mutate();
        toast.error(
          "Couldn't save that change. Try again, or the checklist will refresh next time you open the dashboard."
        );
      }
    },
    [mutate]
  );

  const handleDismiss = useCallback(
    async (itemId) => {
      await mutate(
        (current) => {
          if (!current || !Array.isArray(current.items)) return current;
          const nextItems = current.items.filter((it) => it.id !== itemId);
          const completeCount = nextItems.filter((i) => i.complete).length;
          return {
            ...current,
            items: nextItems,
            completedCount: completeCount,
            progress: {
              ...(current.progress || {}),
              total: nextItems.length,
              complete: completeCount,
              percent:
                nextItems.length > 0
                  ? Math.round((completeCount / nextItems.length) * 100)
                  : 0,
            },
          };
        },
        { revalidate: false }
      );

      try {
        const res = await fetch('/api/setup-checklist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, dismiss: true }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        await mutate();
        toast.error("Couldn't dismiss that item. Try again.");
        return;
      }

      toast('Dismissed.', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await fetch('/api/setup-checklist', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: itemId, dismiss: false }),
              });
            } finally {
              await mutate();
            }
          },
        },
      });
    },
    [mutate]
  );

  const handleDismissAll = useCallback(async () => {
    await mutate(
      (current) => (current ? { ...current, dismissed: true } : current),
      { revalidate: false }
    );
    try {
      await fetch('/api/setup-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      });
    } catch {
      /* best-effort */
    }
  }, [mutate]);

  // Group by call-readiness tier (fall back to legacy `required` flag if an
  // older payload omits `tier`).
  const groupedByTier = useMemo(() => {
    const groups = { essential: [], recommended: [], optional: [] };
    if (data && Array.isArray(data.items)) {
      for (const item of data.items) {
        const tier = item.tier || (item.required ? 'essential' : 'recommended');
        if (groups[tier]) groups[tier].push(item);
      }
    }
    return groups;
  }, [data]);

  const defaultOpenTier = useMemo(() => {
    for (const tier of TIER_ORDER) {
      const tierItems = groupedByTier[tier] || [];
      if (tierItems.some((i) => !i.complete)) return tier;
    }
    return TIER_ORDER[0];
  }, [groupedByTier]);

  if (isLoading || (!data && !error)) {
    return <ChecklistSkeleton />;
  }

  if (error || !data) {
    return null;
  }

  if (data.dismissed) {
    return null;
  }

  const items = Array.isArray(data.items) ? data.items : [];
  const total = items.length;
  const completedCount =
    typeof data.completedCount === 'number'
      ? data.completedCount
      : items.filter((i) => i.complete).length;
  const allComplete = total > 0 && completedCount === total;

  if (allComplete) {
    return (
      <AnimatePresence>
        <SetupCompleteBar onDismiss={handleDismissAll} />
      </AnimatePresence>
    );
  }

  // Essentials drive the headline ring + the call-ready milestone. Computed
  // from the live (optimistically-mutated) item list, not data.readiness, so
  // the meter reacts instantly to mark-done before the server round-trip.
  const essentials = groupedByTier.essential || [];
  const essentialsTotal = essentials.length;
  const essentialsComplete = essentials.filter((i) => i.complete).length;
  const callReady = essentialsTotal > 0 && essentialsComplete === essentialsTotal;

  return (
    <AnimatePresence>
      <motion.div
        initial={prefersReduced ? undefined : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="rounded-2xl border border-border p-6 bg-card"
      >
        {/* Header: essentials progress ring + title */}
        <div className="flex items-center gap-4 mb-5">
          <ProgressRing completed={essentialsComplete} total={essentialsTotal} />
          <div>
            <h2 className="text-base font-semibold text-foreground leading-[1.4]">
              {callReady ? "You're call-ready" : 'Get call-ready'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">
              {callReady
                ? 'Your AI can take and book calls'
                : `${essentialsComplete} of ${essentialsTotal} essentials done`}
            </p>
          </div>
        </div>

        {/* Call-ready milestone — shown once essentials are done but extras remain */}
        {callReady && (
          <div className="flex items-start gap-2 mb-4 rounded-xl bg-[var(--accent-emerald)]/[0.08] border border-[var(--accent-emerald)]/25 px-4 py-3">
            <CheckCircle2
              className="h-4 w-4 text-[var(--accent-emerald)] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-sm text-foreground leading-normal">
              Nice — your AI can already take and book calls. The steps below just
              make it sharper.
            </p>
          </div>
        )}

        {/* Tier accordions */}
        <Accordion type="single" collapsible defaultValue={defaultOpenTier}>
          {TIER_ORDER.map((tier) => {
            const tierItems = groupedByTier[tier] || [];
            if (tierItems.length === 0) return null;

            const tierComplete = tierItems.filter((i) => i.complete).length;
            const tierTotal = tierItems.length;
            const tierAllDone = tierComplete === tierTotal;

            return (
              <AccordionItem key={tier} value={tier} className="border-border">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 flex-1">
                    {tierAllDone && (
                      <CheckCircle2
                        className="h-4 w-4 text-muted-foreground shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-base font-semibold text-foreground leading-[1.4]">
                      {TIER_LABELS[tier]}
                    </span>
                    <span className="text-xs font-normal tracking-wide text-muted-foreground tabular-nums ml-2">
                      {tierComplete} of {tierTotal} done
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground mb-2 px-1 leading-normal">
                    {TIER_SUBLABELS[tier]}
                  </p>
                  <div className="flex flex-col gap-3">
                    {/*
                      Phase 58 CHECKLIST-01 contract — red-dot forwarding:
                      item passes through as a single object so has_error +
                      error_subtitle flow to ChecklistItem's red-dot /
                      "Reconnect needed" / "Reconnect" CTA variant. Do NOT
                      destructure — dropping has_error silently breaks the
                      red-dot flow for failed Xero/Jobber token refresh.
                    */}
                    {tierItems.map((item) => (
                      <ChecklistItem
                        key={item.id}
                        item={item}
                        onMarkDone={handleMarkDone}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </motion.div>
    </AnimatePresence>
  );
}
