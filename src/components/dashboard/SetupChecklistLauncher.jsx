'use client';

/**
 * SetupChecklistLauncher — overlay entry point for the FULL setup checklist.
 *
 * Since the onboarding revamp, the always-visible CallReadinessCard on the home
 * page is the primary guide (essentials meter + next step). This launcher is the
 * secondary surface: a persistent FAB for quick access on any dashboard page,
 * plus the responsive Sheet that holds the complete tiered checklist.
 *
 * Behavior
 *  - The Sheet opens on FAB click OR when any surface dispatches the
 *    `open-setup-checklist` window event (the readiness card's "View all steps"
 *    and its "go further" link both fire it).
 *  - It NO LONGER auto-opens. Auto-popping a sheet on top of the readiness card
 *    (and, for brand-new users, the guided tour) was redundant and jarring.
 *  - FAB (bottom-right, above the mobile BottomTabBar) shows a conic-gradient
 *    overall-progress ring with the count of ESSENTIALS remaining (the number
 *    that gates call-readiness); once essentials are done it shows the remaining
 *    recommended/optional count. Hidden entirely when everything is complete.
 *
 * Progress is fetched here (not via SetupChecklist's onDataLoaded) because Radix
 * Sheet does not mount its children until open=true, so the inner checklist
 * never fetches before the Sheet opens — and the FAB needs progress to render.
 * SWR dedupes the key, so the inner SetupChecklist shares this cached payload.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { focus } from '@/lib/design-tokens';

/**
 * FAB — circular launcher with conic-gradient progress ring and a pending
 * count. Renders nothing when `percent >= 100`.
 */
function SetupChecklistFab({ isMobile, percent, pending, essentialsLeft, onOpen }) {
  if (percent >= 100) return null;

  const size = isMobile ? 48 : 56;
  const bottomOffset = isMobile ? 'bottom-[72px]' : 'bottom-6'; // 72px clears the 64px BottomTabBar + 8px gap
  const label =
    essentialsLeft > 0
      ? essentialsLeft === 1
        ? '1 essential left to finish setup'
        : `${essentialsLeft} essentials left to finish setup`
      : pending === 1
        ? '1 step left to finish setup'
        : `${pending} steps left to finish setup`;

  const ringStyle = {
    background: `conic-gradient(var(--brand-accent) 0% ${percent}%, rgba(255,255,255,0.35) ${percent}% 100%)`,
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      data-tour="setup-checklist-fab"
      className={`
        fixed right-6 ${bottomOffset} z-40
        rounded-full bg-[var(--brand-accent)] text-white
        shadow-[0_6px_18px_-4px_rgba(194,65,12,0.5),0_2px_6px_-2px_rgba(15,23,42,0.2)]
        hover:bg-[var(--brand-accent-hover)] active:scale-95 transition-transform duration-150
        ${focus.ring}
      `}
      style={{ width: size, height: size, minWidth: 44, minHeight: 44 }}
    >
      {/* Conic-gradient progress ring (outer). Inner disc re-paints the body
          so only the ring edge reads as progress. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={ringStyle}
      />
      <span
        aria-hidden="true"
        className="absolute inset-[3px] rounded-full bg-[var(--brand-accent)]"
      />
      {/* Content — centered pending count + accessible label via aria-label */}
      <span
        className="relative z-10 flex items-center justify-center h-full w-full font-semibold tabular-nums leading-none"
        style={{ fontSize: isMobile ? 13 : 15 }}
      >
        {pending}
      </span>
    </button>
  );
}

/**
 * Main launcher. Mounts in DashboardLayoutClient so the Sheet + FAB live above
 * page content and survive route changes.
 */
export default function SetupChecklistLauncher() {
  const isMobile = useIsMobile(1024); // lg: 1024px breakpoint per Tailwind default
  const prefersReduced = useReducedMotion();

  const [open, setOpen] = useState(false);

  const { data: checklistData } = useSWRFetch('/api/setup-checklist', {
    revalidateOnFocus: true,
  });

  // Open on demand — the readiness card's "View all steps" / "go further" links
  // dispatch this event so there's a single way to surface the full checklist.
  useEffect(() => {
    function openFromEvent() {
      setOpen(true);
    }
    window.addEventListener('open-setup-checklist', openFromEvent);
    return () => window.removeEventListener('open-setup-checklist', openFromEvent);
  }, []);

  const progress = useMemo(() => {
    if (!checklistData)
      return { total: 0, complete: 0, percent: 0, essentialsLeft: 0, ready: false };
    if (checklistData.dismissed)
      return { total: 0, complete: 0, percent: 100, essentialsLeft: 0, ready: true };
    const items = Array.isArray(checklistData.items) ? checklistData.items : [];
    const total = items.length;
    const complete = items.filter((i) => i.complete).length;
    const percent = total > 0 ? Math.round((complete / total) * 100) : 100;
    const essentialsLeft = items.filter(
      (i) =>
        (i.tier || (i.required ? 'essential' : 'recommended')) === 'essential' &&
        !i.complete
    ).length;
    return { total, complete, percent, essentialsLeft, ready: true };
  }, [checklistData]);

  const handleFabOpen = useCallback(() => setOpen(true), []);

  const totalRemaining = Math.max(progress.total - progress.complete, 0);
  // Surface essentials first — they gate call-readiness; fall back to total.
  const pending = progress.essentialsLeft > 0 ? progress.essentialsLeft : totalRemaining;
  const allDone = progress.ready && progress.percent >= 100;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={
            isMobile
              ? 'max-h-[85vh] rounded-t-2xl p-0 flex flex-col bg-muted'
              : 'w-[420px] sm:max-w-[420px] p-0 flex flex-col bg-muted'
          }
          aria-label="Setup checklist"
        >
          {/* Drag-handle visual — mobile only, mirrors ChatbotSheet pattern */}
          {isMobile && (
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}

          <SheetHeader className="px-5 pt-5 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              {allDone ? (
                <CheckCircle2 className="h-5 w-5 text-[var(--brand-accent)]" aria-hidden="true" />
              ) : null}
              <SheetTitle className="font-semibold text-base text-foreground leading-[1.4]">
                Finish setting up Voco
              </SheetTitle>
            </div>
            <SheetDescription className="font-normal text-sm text-muted-foreground leading-normal">
              Essentials get your AI taking calls — the rest fine-tunes how it handles them.
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable body — the tiered checklist. Progress is derived at the
              launcher level (see useSWRFetch above); SWR shares the payload. */}
          <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
            <SetupChecklist />
          </div>
        </SheetContent>
      </Sheet>

      {/* FAB — hidden before first data load OR when complete. */}
      {progress.ready && !open && !allDone && (
        <SetupChecklistFab
          isMobile={isMobile}
          percent={progress.percent}
          pending={pending}
          essentialsLeft={progress.essentialsLeft}
          onOpen={handleFabOpen}
          // prefersReduced reserved for a future entrance animation; unused so
          // the button stays instantly visible.
          _prefersReduced={prefersReduced}
        />
      )}
    </>
  );
}
