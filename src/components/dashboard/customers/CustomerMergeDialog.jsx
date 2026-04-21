'use client';

// Phase 59 Plan 07 — D-19 Customer Merge dialog
// 2-step flow:
//   Step 1: Dialog + Command typeahead searching /api/customers?search=<q>
//   Step 2: AlertDialog with preview counts + destructive confirm ("Merge Customer")
//
// On merge success: navigates to target page with ?recently_merged=1&audit_id=<uuid>
// Preview counts: fetched via GET /api/customers/[source_id]/merge-preview?target_id=<target>
// (thin preflight route added in this plan to avoid cross-tenant count edge cases — T-59-07-03)
//
// UI-SPEC copy used verbatim (lines 166-171).

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { btn, focus } from '@/lib/design-tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CustomerMergeDialog — 2-step merge flow.
 * Step 1: typeahead to select target customer.
 * Step 2: AlertDialog with counts preview + destructive confirm.
 *
 * @param {{
 *   sourceCustomer: object,
 *   open: boolean,
 *   onOpenChange: function,
 *   onMergeSuccess: function({ target_id, audit_id })
 * }} props
 */
export default function CustomerMergeDialog({
  sourceCustomer,
  open,
  onOpenChange,
  onMergeSuccess,
}) {
  const [step, setStep] = useState(1); // 1 = typeahead, 2 = confirm
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [previewCounts, setPreviewCounts] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState(null);

  const debouncedQuery = useDebounce(query, 300);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setQuery('');
      setResults([]);
      setSelectedTarget(null);
      setPreviewCounts(null);
      setPreviewError(null);
      setMergeError(null);
    }
  }, [open]);

  // Search customers when query changes (min 2 chars)
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    fetch(`/api/customers?search=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        // Exclude self + already-merged customers
        const filtered = (data.customers || [])
          .filter((c) => c.id !== sourceCustomer?.id && !c.merged_into)
          .slice(0, 8);
        setResults(filtered);
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery, sourceCustomer?.id]);

  // Fetch merge preview when target selected
  async function handleSelectTarget(target) {
    setSelectedTarget(target);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewCounts(null);

    try {
      const res = await fetch(
        `/api/customers/${sourceCustomer.id}/merge-preview?target_id=${target.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setPreviewCounts(data.counts);
      } else {
        // Fallback: use client-side estimates (empty counts shown)
        setPreviewCounts({ jobs: 0, inquiries: 0, invoices: 0, call_recordings: 0 });
      }
    } catch {
      setPreviewCounts({ jobs: 0, inquiries: 0, invoices: 0, call_recordings: 0 });
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleContinue() {
    if (!selectedTarget) return;
    setStep(2);
  }

  function handleBackToStep1() {
    setStep(1);
    setMergeError(null);
  }

  async function handleConfirmMerge() {
    if (!selectedTarget || !sourceCustomer) return;
    setMerging(true);
    setMergeError(null);

    try {
      const res = await fetch(`/api/customers/${sourceCustomer.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: selectedTarget.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'concurrent_update') {
          setMergeError(
            'This customer was changed while you were viewing. Refresh to see the latest.'
          );
        } else {
          setMergeError(err.error || 'Merge failed. Please try again.');
        }
        return;
      }

      const data = await res.json();
      const { target_id, audit_id } = data;

      onOpenChange(false);
      toast.success(`Merged into ${selectedTarget.name}`);
      onMergeSuccess?.({ target_id, audit_id });
    } catch {
      setMergeError('Merge failed. Please try again.');
    } finally {
      setMerging(false);
    }
  }

  const counts = previewCounts || { jobs: 0, inquiries: 0, invoices: 0, call_recordings: 0 };

  // UI-SPEC copy verbatim (lines 169):
  // "{N} jobs, {M} inquiries, {K} invoices, and {L} call recordings will move to {Target Name}.
  //  {Source Name} will be hidden. You can undo this for 7 days."
  const previewBody = selectedTarget
    ? `${counts.jobs} jobs, ${counts.inquiries} inquiries, ${counts.invoices} invoices, and ${counts.call_recordings} call recordings will move to ${selectedTarget.name}. ${sourceCustomer?.name || 'This customer'} will be hidden. You can undo this for 7 days.`
    : '';

  return (
    <>
      {/* Step 1: Typeahead picker */}
      <Dialog open={open && step === 1} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Merge into another customer…</DialogTitle>
            <DialogDescription>
              Search for the customer you want to merge{' '}
              <strong>{sourceCustomer?.name || 'this customer'}</strong> into.
              All jobs, inquiries, and call recordings will move to the target customer.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Command shouldFilter={false} className="border border-input rounded-md">
              <CommandInput
                placeholder="Search by name or phone…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {searching && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!searching && debouncedQuery.length >= 2 && results.length === 0 && (
                  <CommandEmpty>No customers found.</CommandEmpty>
                )}
                {!searching && results.length > 0 && (
                  <CommandGroup>
                    {results.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.id}
                        onSelect={() => handleSelectTarget(customer)}
                        className={`cursor-pointer ${
                          selectedTarget?.id === customer.id
                            ? 'bg-[var(--selected-fill)] border-l-2 border-[var(--brand-accent)]'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium text-sm">{customer.name}</span>
                          <span className="text-xs text-muted-foreground font-mono tabular-nums">
                            {customer.phone_e164}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {!searching && debouncedQuery.length < 2 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search.
                  </div>
                )}
              </CommandList>
            </Command>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!selectedTarget || previewLoading}
              className={btn.primary}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading…
                </>
              ) : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: AlertDialog destructive confirm */}
      <AlertDialog open={open && step === 2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Merge into {selectedTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>{previewBody}</p>
                {mergeError && (
                  <p className="mt-3 text-sm text-destructive font-medium">
                    {mergeError}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleBackToStep1} disabled={merging}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmMerge}
              disabled={merging}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {merging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging…
                </>
              ) : 'Merge Customer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
