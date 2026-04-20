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

// ─── Theme group metadata (Phase 48 D-02) ───────────────────────────────────
const THEME_ORDER = ['profile', 'voice', 'calendar', 'billing'];
const THEME_LABELS = {
  profile: 'Profile',
  voice: 'Voice',
  calendar: 'Calendar',
  billing: 'Billing',
};

// ─── Progress ring (conic-gradient) ──────────────────────────────────────────

function ProgressRing({ completed, total }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;

  const style = {
    background: `conic-gradient(
      var(--brand-accent) 0% ${pct}%,
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

  const groupedByTheme = useMemo(() => {
    const groups = { profile: [], voice: [], calendar: [], billing: [] };
    if (data && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (groups[item.theme]) groups[item.theme].push(item);
      }
    }
    return groups;
  }, [data]);

  const defaultOpenTheme = useMemo(() => {
    for (const theme of THEME_ORDER) {
      const items = groupedByTheme[theme] || [];
      if (items.some((i) => !i.complete)) return theme;
    }
    return THEME_ORDER[1];
  }, [groupedByTheme]);

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

  return (
    <AnimatePresence>
      <motion.div
        initial={prefersReduced ? undefined : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="rounded-2xl border border-border p-6 bg-card"
      >
        {/* Header: progress ring + title */}
        <div className="flex items-center gap-4 mb-5">
          <ProgressRing completed={completedCount} total={total} />
          <div>
            <h2 className="text-base font-semibold text-foreground leading-[1.4]">
              Your setup checklist
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">
              {completedCount} of {total} complete
            </p>
          </div>
        </div>

        {/* Theme accordions */}
        <Accordion type="single" collapsible defaultValue={defaultOpenTheme}>
          {THEME_ORDER.map((theme) => {
            const themeItems = groupedByTheme[theme] || [];
            if (themeItems.length === 0) return null;

            const themeComplete = themeItems.filter((i) => i.complete).length;
            const themeTotal = themeItems.length;
            const themeAllDone = themeComplete === themeTotal;

            return (
              <AccordionItem key={theme} value={theme} className="border-border">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 flex-1">
                    {themeAllDone && (
                      <CheckCircle2
                        className="h-4 w-4 text-muted-foreground shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-base font-semibold text-foreground leading-[1.4]">
                      {THEME_LABELS[theme]}
                    </span>
                    <span className="text-xs font-normal tracking-wide text-muted-foreground tabular-nums ml-2">
                      {themeComplete} of {themeTotal} complete
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-3">
                    {/*
                      Phase 58 CHECKLIST-01 contract — red-dot forwarding:
                      item passes through as a single object so has_error +
                      error_subtitle flow to ChecklistItem's red-dot /
                      "Reconnect needed" / "Reconnect" CTA variant. Do NOT
                      destructure — dropping has_error silently breaks the
                      red-dot flow for failed Xero/Jobber token refresh.
                    */}
                    {themeItems.map((item) => (
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
