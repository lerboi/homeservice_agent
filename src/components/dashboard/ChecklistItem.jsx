'use client';

import { CheckCircle2, Circle, X, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { btn } from '@/lib/design-tokens';

/**
 * ChecklistItem — single row in the themed setup checklist accordion.
 *
 * @param {{
 *   item: {
 *     id: string,
 *     theme: string,
 *     required: boolean,
 *     complete: boolean,
 *     dismissed?: boolean,
 *     mark_done_override?: boolean,
 *     title: string,
 *     description?: string,
 *     href?: string,
 *     has_error?: boolean,
 *     error_subtitle?: string | null,
 *   },
 *   onMarkDone: (itemId: string, nextValue: boolean) => void,
 *   onDismiss: (itemId: string) => void,
 * }} props
 */
export default function ChecklistItem({ item, onMarkDone, onDismiss }) {
  const prefersReduced = useReducedMotion();

  const isComplete = item.complete === true;
  const isOverridden = item.mark_done_override === true;

  // CTA copy per UI-SPEC Copywriting Contract (Primary CTAs table)
  //  - `Reconnect` — row in error state, regardless of required/recommended
  //    (Phase 58 CHECKLIST-01, UI-SPEC §10.3) — this branch FIRST so
  //    connect_xero / connect_jobber (recommended) flip to "Reconnect" when
  //    token refresh fails, not "Open settings".
  //  - `Finish setup` — required row, not started
  //  - `Continue` — partially done (mark_done_override flag is used here as signal)
  //  - `Open settings` — recommended-only row (default)
  let primaryLabel = 'Finish setup';
  if (item.has_error) {
    primaryLabel = 'Reconnect';
  } else if (!item.required) {
    primaryLabel = 'Open settings';
  } else if (isOverridden && !isComplete) {
    primaryLabel = 'Continue';
  }

  // Required items cannot be dismissed (product sensibility per plan spec).
  const canDismiss = !item.required;

  return (
    <motion.div
      layout
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex items-start gap-3 py-3 px-1 border-b border-border last:border-b-0"
    >
      {/* Completion icon — Phase 58 CHECKLIST-01 adds red-dot variant for has_error.
          Priority: complete wins (defensive; API never emits complete+has_error
          simultaneously, but if it ever did, CheckCircle2 renders). */}
      {isComplete ? (
        <CheckCircle2
          className="h-5 w-5 text-[var(--brand-accent)] shrink-0 mt-0.5"
          aria-hidden="true"
        />
      ) : item.has_error ? (
        <span
          className="h-5 w-5 shrink-0 mt-0.5 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />
        </span>
      ) : (
        <Circle
          className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5"
          aria-hidden="true"
        />
      )}

      {/* Content: title + badge + description + actions */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm leading-normal ${
              isComplete ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
          >
            {item.title}
          </span>
          {item.required ? (
            <Badge className="bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20 font-normal text-xs tracking-wide uppercase leading-[1.4]">
              Required
            </Badge>
          ) : (
            <Badge className="bg-muted text-muted-foreground border border-border font-normal text-xs tracking-wide uppercase leading-[1.4]">
              Recommended
            </Badge>
          )}
        </div>

        {/* Phase 58 CHECKLIST-01 — error subtitle between title row and description.
            Meaningful for screen readers (the red dot above is aria-hidden).
            Locked copy (UI-SPEC §10.3): "Reconnect needed" — the API emits this
            string verbatim via error_subtitle; changing the copy requires a
            UI-SPEC change, not a component edit. */}
        {item.has_error && item.error_subtitle && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">
            {item.error_subtitle}
          </p>
        )}

        {item.description && (
          <p className="text-sm text-muted-foreground leading-normal mt-1">
            {item.description}
          </p>
        )}

        {/* Action buttons row */}
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {/* Jump to page / primary CTA — hidden when complete */}
          {!isComplete && item.href && (
            <Link
              href={item.href}
              className={`${btn.primary} inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1`}
              aria-label={`${primaryLabel}: ${item.title}`}
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}

          {/* Mark done / Unmark done */}
          <button
            type="button"
            onClick={() => onMarkDone?.(item.id, !(isComplete && isOverridden))}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
            aria-label={
              isComplete && isOverridden
                ? `Unmark ${item.title} as done`
                : `Mark ${item.title} as done`
            }
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {isComplete && isOverridden ? 'Unmark done' : 'Mark done'}
          </button>

          {/* Dismiss — icon-only, hidden for required items */}
          {canDismiss && (
            <button
              type="button"
              onClick={() => onDismiss?.(item.id)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
              aria-label={`Dismiss ${item.title}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
