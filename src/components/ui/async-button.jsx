'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * <AsyncButton /> — POLISH-05 pending-state wrapper around shadcn Button.
 *
 * Locked prop API (58-UI-SPEC §4.3):
 *   pending       required — boolean
 *   pendingLabel  optional — falls back to children when absent
 *   ...rest       passes through to Button (variant, size, onClick, type, className, asChild)
 *
 * Rules:
 *   - When pending=true: disabled, Loader2 spinner (animate-spin), label swaps to
 *     pendingLabel (or children if pendingLabel absent).
 *   - Parent `disabled` prop ORs with pending — both disable.
 *   - aria-busy is NOT set on the button (disabled already conveys the state;
 *     page-level aria-busy belongs on the section container, not the button).
 */
export function AsyncButton({ pending, pendingLabel, disabled, children, ...rest }) {
  return (
    <Button disabled={pending || disabled} {...rest}>
      {pending && (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
      )}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
