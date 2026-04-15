'use client';

/**
 * HelpDiscoverabilityCard — "Where do I…" quick-link tile grid (HOME-06).
 *
 * Surfaces 4 high-intent owner tasks that are NOT already covered by the
 * setup checklist (checklist handles onboarding config; this card handles
 * ongoing ops). Labels follow verb+noun sentence case per UI-SPEC Copywriting
 * Contract (D-14, D-15).
 *
 * Per UI-SPEC Color rules: tile backgrounds stay card; only the optional
 * trailing arrow icon tints to brand-accent on hover (group-hover). Tile count is
 * a static 4 — no data fetching.
 *
 * Typography: only `font-normal` and `font-semibold` are used anywhere on
 * this surface (two-weight rule W7). The shadcn Badge/Button defaults that
 * would introduce a heavier weight are intentionally NOT used here — tiles
 * are plain `<Link>` elements.
 */

import Link from 'next/link';
import { Wrench, Mic, Phone, Receipt, ArrowUpRight } from 'lucide-react';
import { card, focus } from '@/lib/design-tokens';

export default function HelpDiscoverabilityCard() {
  return (
    <section
      aria-label="Help and discoverability"
      className={`${card.base} p-4 md:p-6`}
    >
      {/* Eyebrow caption per UI-SPEC Copywriting Contract ("Where do I…") */}
      <p className="font-normal text-xs tracking-wide uppercase text-muted-foreground leading-[1.4]">
        Where do I…
      </p>

      {/* Tile grid — 2 cols on mobile, 4 cols on md+ per UI-SPEC */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Link
          href="/dashboard/services"
          className={`group ${card.base} ${card.hover} ${focus.ring} flex flex-col items-start gap-2 p-4 min-h-[88px] no-underline`}
        >
          <div className="flex items-center justify-between w-full">
            <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-[var(--brand-accent)] transition-colors" aria-hidden="true" />
          </div>
          <span className="font-normal text-sm text-foreground leading-normal">
            Add a service
          </span>
        </Link>

        <Link
          href="/dashboard/ai-voice-settings"
          className={`group ${card.base} ${card.hover} ${focus.ring} flex flex-col items-start gap-2 p-4 min-h-[88px] no-underline`}
        >
          <div className="flex items-center justify-between w-full">
            <Mic className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-[var(--brand-accent)] transition-colors" aria-hidden="true" />
          </div>
          <span className="font-normal text-sm text-foreground leading-normal">
            Change AI voice
          </span>
        </Link>

        <Link
          href="/dashboard/escalation-contacts"
          className={`group ${card.base} ${card.hover} ${focus.ring} flex flex-col items-start gap-2 p-4 min-h-[88px] no-underline`}
        >
          <div className="flex items-center justify-between w-full">
            <Phone className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-[var(--brand-accent)] transition-colors" aria-hidden="true" />
          </div>
          <span className="font-normal text-sm text-foreground leading-normal">
            Set escalation contacts
          </span>
        </Link>

        <Link
          href="/dashboard/more/billing"
          className={`group ${card.base} ${card.hover} ${focus.ring} flex flex-col items-start gap-2 p-4 min-h-[88px] no-underline`}
        >
          <div className="flex items-center justify-between w-full">
            <Receipt className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-[var(--brand-accent)] transition-colors" aria-hidden="true" />
          </div>
          <span className="font-normal text-sm text-foreground leading-normal">
            View invoices
          </span>
        </Link>
      </div>
    </section>
  );
}
