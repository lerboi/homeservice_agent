'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * <EmptyState /> — POLISH-01 generic empty-state primitive.
 *
 * Locked prop API (58-UI-SPEC §4.1):
 *   icon          required — lucide-react component reference
 *   headline      required — string, sentence case
 *   description   optional — string, max ~160 chars
 *   ctaLabel      optional — renders CTA when present
 *   ctaHref       optional — mutually exclusive with ctaOnClick
 *   ctaOnClick    optional — mutually exclusive with ctaHref
 *
 * Rules:
 *   - If ctaLabel is provided, exactly one of ctaHref | ctaOnClick must be set.
 *   - Icon is always rendered (no icon-less variant).
 *   - Uses semantic tokens only (no hardcoded colours) — dark-mode aware.
 */
export function EmptyState({ icon: Icon, headline, description, ctaLabel, ctaHref, ctaOnClick }) {
  const hasCta = !!ctaLabel && (ctaHref || ctaOnClick);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/30 mb-4" aria-hidden="true" />
      <h2 className="text-base font-semibold text-foreground mb-2">{headline}</h2>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      {hasCta && ctaHref && (
        <Button asChild>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      )}
      {hasCta && !ctaHref && ctaOnClick && (
        <Button onClick={ctaOnClick}>{ctaLabel}</Button>
      )}
    </div>
  );
}
