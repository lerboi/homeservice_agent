'use client';

/**
 * SetupChecklistLauncher — overlay entry point for the setup checklist.
 *
 * Revision of Plan 48-05 D-04/D-07 page-wiring decisions: the owner asked for
 * the checklist to become hidden-by-default and opened via an FAB (with a
 * responsive Sheet), instead of occupying real estate at the top of the
 * dashboard home page. See 48-05 SUMMARY "Revision" section for rationale.
 *
 * Behavior
 *  - Desktop (≥ lg, 1024px+): Sheet slides in from the right so page content
 *    stays visible. On first dashboard visit per session, the Sheet auto-opens
 *    (gated by `sessionStorage['voco_setup_opened']`). When closed, a circular
 *    FAB anchors bottom-right with a conic-gradient progress ring and a
 *    "N left" badge — clicking it reopens the Sheet.
 *  - Mobile (< lg): no auto-open (would block page content). Smaller FAB
 *    anchored bottom-right, offset above the 64px `BottomTabBar`. Sheet slides
 *    in from the bottom for the drawer pattern shadcn Sheet gives us free.
 *  - Completion: when the server reports progress.percent === 100 (or no items
 *    remain), the FAB hides entirely — nothing to launch. Auto-open also
 *    skips in this case.
 *
 * The existing `SetupChecklist` component (from Plan 48-03) is unchanged —
 * this launcher wraps it and consumes its `onDataLoaded` callback to learn
 * the progress state.
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

// Session-storage key — matches the project's `voco_*` naming convention
// (see src/hooks/useWizardSession.js for other voco_* keys).
const SESSION_KEY = 'voco_setup_opened';

/**
 * Per-session auto-open guard.
 *  - Reads `sessionStorage['voco_setup_opened']`.
 *  - Returns `true` when the gate has NOT been set yet (i.e. first visit).
 *  - Safe during SSR — returns `false` when window is unavailable.
 */
function shouldAutoOpen() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) !== '1';
  } catch {
    return false;
  }
}

function markAutoOpenFired() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* best-effort only */
  }
}

/**
 * FAB — circular launcher button with conic-gradient progress ring and
 * pending-count badge. Renders nothing when `percent >= 100`.
 */
function SetupChecklistFab({ isMobile, percent, pending, onOpen }) {
  if (percent >= 100) return null;

  const size = isMobile ? 48 : 56;
  const bottomOffset = isMobile ? 'bottom-[72px]' : 'bottom-6'; // 72px clears the 64px BottomTabBar + 8px gap
  const label = pending === 1 ? '1 step left to finish setup' : `${pending} steps left to finish setup`;

  const ringStyle = {
    background: `conic-gradient(#C2410C 0% ${percent}%, rgba(255,255,255,0.35) ${percent}% 100%)`,
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
        rounded-full bg-[#C2410C] text-white
        shadow-[0_6px_18px_-4px_rgba(194,65,12,0.5),0_2px_6px_-2px_rgba(15,23,42,0.2)]
        hover:bg-[#B53B0A] active:scale-95 transition-transform duration-150
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
        className="absolute inset-[3px] rounded-full bg-[#C2410C]"
      />
      {/* Content — centered fraction + sr-only semantic count */}
      <span className="relative z-10 flex items-center justify-center h-full w-full font-semibold tabular-nums leading-none"
            style={{ fontSize: isMobile ? 13 : 15 }}>
        {pending}
      </span>
      {/* Label-only pill (optional small accent below the button on large screens
          is skipped — the tooltip + aria-label carry the same info without
          extra visual noise per Phase 48 spec). */}
    </button>
  );
}

/**
 * Main launcher. Mounts alongside `ChatbotSheet` in dashboard/layout.js so
 * the Sheet + FAB live above page content and survive route changes.
 */
export default function SetupChecklistLauncher() {
  const isMobile = useIsMobile(1024); // lg: 1024px breakpoint per Tailwind default
  const prefersReduced = useReducedMotion();

  const [open, setOpen] = useState(false);

  // Progress is derived from /api/setup-checklist directly here in the launcher,
  // NOT from <SetupChecklist>'s onDataLoaded callback. Reason: shadcn/Radix Sheet
  // does not mount its children until open=true, so the inner SetupChecklist
  // never fetches before the Sheet opens — and the FAB + auto-open both need
  // progress to decide whether to render at all. By fetching here, the launcher
  // can show the FAB immediately and auto-open on first session visit. SWR
  // deduplicates the key, so the inner SetupChecklist shares this cached data.
  const { data: checklistData } = useSWRFetch('/api/setup-checklist', {
    revalidateOnFocus: true,
  });

  const progress = useMemo(() => {
    if (!checklistData) return { total: 0, complete: 0, percent: 0, ready: false };
    if (checklistData.dismissed) return { total: 0, complete: 0, percent: 100, ready: true };
    const items = Array.isArray(checklistData.items) ? checklistData.items : [];
    const total = items.length;
    const complete = items.filter((i) => i.complete).length;
    const percent = total > 0 ? Math.round((complete / total) * 100) : 100;
    return { total, complete, percent, ready: true };
  }, [checklistData]);

  // Auto-open gate — desktop only, first session visit, only if incomplete.
  useEffect(() => {
    if (!progress.ready) return;
    if (isMobile) return;
    if (progress.percent >= 100) return;
    if (!shouldAutoOpen()) return;

    setOpen(true);
    markAutoOpenFired();
  }, [progress.ready, progress.percent, isMobile]);

  // Whenever the Sheet closes via user action, make sure the gate is set so
  // it does not reopen on the next state change.
  const handleOpenChange = useCallback((next) => {
    setOpen(next);
    if (!next) markAutoOpenFired();
  }, []);

  const handleFabOpen = useCallback(() => setOpen(true), []);

  const pending = Math.max(progress.total - progress.complete, 0);
  const allDone = progress.ready && progress.percent >= 100;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={
            isMobile
              ? 'max-h-[85vh] rounded-t-2xl p-0 flex flex-col bg-[#F5F5F4]'
              : 'w-[420px] sm:max-w-[420px] p-0 flex flex-col bg-[#F5F5F4]'
          }
          aria-label="Setup checklist"
        >
          {/* Drag-handle visual — mobile only, mirrors ChatbotSheet pattern */}
          {isMobile && (
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-8 h-1 rounded-full bg-stone-300" />
            </div>
          )}

          <SheetHeader className="px-5 pt-5 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              {allDone ? (
                <CheckCircle2 className="h-5 w-5 text-[#C2410C]" aria-hidden="true" />
              ) : null}
              <SheetTitle className="font-semibold text-base text-[#0F172A] leading-[1.4]">
                Finish setting up Voco
              </SheetTitle>
            </div>
            <SheetDescription className="font-normal text-sm text-[#475569] leading-normal">
              A few quick steps to get Voco answering every call the way you want.
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable body — the actual checklist is unchanged from Plan 48-03.
              Progress is derived at the launcher level (see useSWRFetch above);
              no onDataLoaded prop needed — SWR shares the cached payload. */}
          <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
            <SetupChecklist />
          </div>
        </SheetContent>
      </Sheet>

      {/* FAB — hidden before first data load OR when complete; respects
          reduced-motion by nature (no entrance animation on this element). */}
      {progress.ready && !open && !allDone && (
        <SetupChecklistFab
          isMobile={isMobile}
          percent={progress.percent}
          pending={pending}
          onOpen={handleFabOpen}
          // prefersReduced reserved for future entrance animation if added;
          // currently unused so the button stays instantly visible.
          _prefersReduced={prefersReduced}
        />
      )}
    </>
  );
}
