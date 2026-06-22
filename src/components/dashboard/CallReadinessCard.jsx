'use client';

/**
 * CallReadinessCard — the home-page onboarding indicator.
 *
 * One job: answer "how close am I to my AI fully taking and booking calls?" and
 * point at the single next action. It tracks ESSENTIAL checklist items only
 * (the call-readiness meter); recommended/optional steps live in the full
 * checklist behind "View all steps" (the FAB + Sheet via SetupChecklistLauncher).
 *
 * States:
 *   loading          → skeleton
 *   not call-ready   → segmented essentials bar + "Next step" CTA deep-link
 *   call-ready       → calm success state (+ optional "go further", dismissible)
 *   dismissed / done → renders nothing (greeting + ops surfaces lead instead)
 *
 * The live AI line status (active/paused) stays in the page greeting row — this
 * card is purely about *setup completeness*, so the two signals don't compete.
 */

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { btn, card, focus } from '@/lib/design-tokens';

// localStorage flag — only suppresses the *call-ready* success state so it stops
// nagging once acknowledged. The not-ready nudge always shows (if an essential
// later lapses, e.g. billing, the card returns on its own). Read via
// useSyncExternalStore — the project bans setState-in-effect.
const DISMISS_KEY = 'voco_readiness_dismissed';
const DISMISS_EVENT = 'voco-readiness-dismissed-change';

function subscribeReadyDismissed(onChange) {
  window.addEventListener('storage', onChange);
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(DISMISS_EVENT, onChange);
  };
}
const getReadyDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};
const getReadyDismissedServer = () => false;

function openFullChecklist() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('open-setup-checklist'));
  }
}

/** Segmented progress bar — one segment per essential step. */
function SegmentBar({ total, complete }) {
  if (total <= 0) return null;
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
            i < complete ? 'bg-[var(--accent-emerald)]' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  );
}

export default function CallReadinessCard() {
  const prefersReduced = useReducedMotion();
  const { data, error, isLoading } = useSWRFetch('/api/setup-checklist', {
    revalidateOnFocus: true,
  });

  const readyDismissed = useSyncExternalStore(
    subscribeReadyDismissed,
    getReadyDismissed,
    getReadyDismissedServer
  );

  const dismissReady = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* best-effort */
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(DISMISS_EVENT));
    }
  }, []);

  if (isLoading || (!data && !error)) {
    return (
      <div className={`${card.base} p-5`} aria-hidden="true">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-9 w-full mt-4 rounded-md" />
      </div>
    );
  }

  // No data, fetch error, or the whole checklist was dismissed → stay out of the way.
  if (error || !data || data.dismissed) return null;

  const items = Array.isArray(data.items) ? data.items : [];
  const essentials = items.filter(
    (i) => (i.tier || (i.required ? 'essential' : 'recommended')) === 'essential'
  );
  const essentialsTotal = data.readiness?.essentialsTotal ?? essentials.length;
  const essentialsComplete =
    data.readiness?.essentialsComplete ?? essentials.filter((i) => i.complete).length;
  const callReady =
    data.readiness?.callReady ??
    (essentialsTotal > 0 && essentialsComplete === essentialsTotal);

  const incompleteTotal = items.filter((i) => !i.complete).length;

  // ─── Call-ready: calm success state (dismissible) ──────────────────────────
  if (callReady) {
    if (readyDismissed) return null;
    return (
      <motion.div
        initial={prefersReduced ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex items-start gap-3 rounded-2xl border border-[var(--accent-emerald)]/25 bg-[var(--accent-emerald)]/[0.08] p-5"
        data-tour="call-readiness"
      >
        <CheckCircle2
          className="h-5 w-5 shrink-0 text-[var(--accent-emerald)] mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-[1.4]">
            You&apos;re call-ready
          </p>
          <p className="text-sm text-muted-foreground leading-normal mt-0.5">
            Your AI is set up to take and book calls.
            {incompleteTotal > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={openFullChecklist}
                  className={`underline underline-offset-2 hover:text-foreground transition-colors ${focus.ring} rounded`}
                >
                  {incompleteTotal === 1
                    ? '1 optional step to go further'
                    : `${incompleteTotal} steps to go further`}
                </button>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={dismissReady}
          aria-label="Dismiss"
          className={`shrink-0 text-muted-foreground/70 hover:text-foreground transition-colors ${focus.ring} rounded`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </motion.div>
    );
  }

  // ─── Not call-ready: essentials meter + next-step CTA ──────────────────────
  const nextStep = essentials.find((i) => !i.complete) || null;

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`${card.base} p-5`}
      data-tour="call-readiness"
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <h2 className="text-base font-semibold text-foreground leading-[1.4]">
          Get your AI call-ready
        </h2>
        <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
          {essentialsComplete} of {essentialsTotal} essentials
        </span>
      </div>

      <SegmentBar total={essentialsTotal} complete={essentialsComplete} />

      {nextStep && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground leading-tight">
              Next step
            </p>
            <p className="text-sm font-medium text-foreground leading-snug mt-0.5">
              {nextStep.title}
            </p>
            {nextStep.description && (
              <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                {nextStep.description}
              </p>
            )}
          </div>
          <Link
            href={nextStep.href || '#'}
            className={`${btn.primary} inline-flex shrink-0 items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-md text-sm ${focus.ring}`}
            aria-label={`Set up: ${nextStep.title}`}
          >
            Set it up
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={openFullChecklist}
        className={`mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ${focus.ring} rounded`}
      >
        View all setup steps
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
