'use client';

// Phase 59 Plan 07 — D-19 Unmerge banner
// Shown on target customer page for 7 days after a merge.
// Appears when ?recently_merged=1 in URL OR when the customer has active merges
// (source rows with merged_at > now() - 7 days).
//
// Dismissible via X — stores dismissal in localStorage per merge audit id.
// "Undo merge" → POST /api/customers/{source_id}/unmerge
//   - 200 → navigate to source customer
//   - 410 → toast "The 7-day undo window has expired." + link to /dashboard/admin/merges
//
// Copy: "Merge complete. This customer now includes records from {Source Name}.
//        You can undo this for 7 days."
// UI-SPEC: border-l-4 border-[var(--brand-accent)]

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { focus } from '@/lib/design-tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBannerDismissKey(auditId) {
  return `voco_unmerge_dismissed_${auditId}`;
}

function isBannerDismissed(auditId) {
  if (!auditId || typeof localStorage === 'undefined') return false;
  return localStorage.getItem(getBannerDismissKey(auditId)) === '1';
}

function dismissBanner(auditId) {
  if (!auditId || typeof localStorage === 'undefined') return;
  localStorage.setItem(getBannerDismissKey(auditId), '1');
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * UnmergeBanner — shown on target customer page after a merge.
 * Fetches recent merge info to get source customer name + source_id for undo.
 * Handles ?recently_merged=1 URL param (from merge navigation) or API detection.
 *
 * @param {{ customerId: string, customer: object, auditId?: string }} props
 */
export default function UnmergeBanner({ customerId, customer, auditId }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [mergeInfo, setMergeInfo] = useState(null); // { source_id, source_name, audit_id }
  const [undoing, setUndoing] = useState(false);

  const fetchMergeInfo = useCallback(async () => {
    if (!customerId) return;

    // If we have an auditId from the URL, check localStorage first
    if (auditId && isBannerDismissed(auditId)) {
      setVisible(false);
      return;
    }

    try {
      // Look for active merges targeting this customer in the last 7 days
      const res = await fetch(`/api/admin/merges?focus=${customerId}&active=1`);
      if (!res.ok) return;

      const data = await res.json();
      const merges = data.merges || [];

      // Find merges where this customer is the TARGET (not the source)
      const activeMerge = merges.find(
        (m) => m.target_customer?.id === customerId && !m.unmerged_at
      );

      if (!activeMerge) {
        setVisible(false);
        return;
      }

      const mergeAuditId = activeMerge.id;

      // Check if dismissed for this specific merge
      if (isBannerDismissed(mergeAuditId)) {
        setVisible(false);
        return;
      }

      // Check if merge is within 7-day window
      const mergedAt = new Date(activeMerge.merged_at);
      const daysSince = (Date.now() - mergedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) {
        setVisible(false);
        return;
      }

      setMergeInfo({
        source_id: activeMerge.source_customer?.id,
        source_name: activeMerge.source_customer?.name || 'another customer',
        audit_id: mergeAuditId,
      });
      setVisible(true);
    } catch {
      // Non-fatal — banner just won't show
    }
  }, [customerId, auditId]);

  useEffect(() => {
    fetchMergeInfo();
  }, [fetchMergeInfo]);

  function handleDismiss() {
    if (mergeInfo?.audit_id) {
      dismissBanner(mergeInfo.audit_id);
    }
    setVisible(false);
  }

  async function handleUndo() {
    if (!mergeInfo?.source_id) return;
    setUndoing(true);

    try {
      const res = await fetch(`/api/customers/${mergeInfo.source_id}/unmerge`, {
        method: 'POST',
      });

      if (res.status === 410) {
        toast.error(
          'The 7-day undo window has expired. Merge history remains in the admin Merges view.',
          {
            action: {
              label: 'View history',
              onClick: () => router.push('/dashboard/admin/merges'),
            },
            duration: 8000,
          }
        );
        setVisible(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Undo failed. Please try again.');
        return;
      }

      const data = await res.json();
      toast.success('Merge undone. Customer restored.');
      setVisible(false);

      // Navigate back to the source customer
      const sourceId = data.source_id || mergeInfo.source_id;
      router.push(`/dashboard/customers/${sourceId}`);
    } catch {
      toast.error('Undo failed. Please try again.');
    } finally {
      setUndoing(false);
    }
  }

  if (!visible || !mergeInfo) return null;

  return (
    <div className="mt-4 flex items-start gap-4 px-4 py-3 rounded-lg bg-card border-l-4 border-[var(--brand-accent)] shadow-sm">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Merge complete.
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          This customer now includes records from{' '}
          <strong>{mergeInfo.source_name}</strong>. You can undo this for 7 days.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={undoing}
          className="font-medium"
        >
          {undoing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Undoing…
            </>
          ) : 'Undo merge'}
        </Button>

        <button
          type="button"
          onClick={handleDismiss}
          className={`p-1 rounded text-muted-foreground hover:text-foreground transition-colors ${focus.ring}`}
          aria-label="Dismiss merge banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
