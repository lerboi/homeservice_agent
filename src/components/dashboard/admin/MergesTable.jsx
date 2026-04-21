'use client';

// Phase 59 Plan 07 — D-19 expanded: Admin Merges table
// Columns: When | Source | Target | Merged by | Status | Records moved | Actions
// Status: "Active" (green dot) if unmerged_at IS NULL; "Unmerged {date}" (muted) if set.
// Records moved: compact summary "5 jobs, 2 inquiries, 1 invoice" (zeros omitted)
//   with tooltip showing full row_counts JSONB.
// Actions: "View source" + "View target" link buttons to /dashboard/customers/{id}
//   (View source may be soft-deleted — customer detail 404 state handles gracefully)
//
// No sidebar/BottomTabBar link added — admin-only, discoverable via direct URL or
// CustomerDetailHeader overflow menu only (D-19 expanded).

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatShortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Format row_counts JSONB as compact summary, hiding zero-count entries.
 * e.g. {jobs: 3, inquiries: 0, invoices: 1} → "3 jobs, 1 invoice"
 */
function formatRowCountsSummary(row_counts) {
  if (!row_counts) return '—';
  const labels = {
    jobs: (n) => `${n} job${n !== 1 ? 's' : ''}`,
    inquiries: (n) => `${n} ${n !== 1 ? 'inquiries' : 'inquiry'}`,
    invoices: (n) => `${n} invoice${n !== 1 ? 's' : ''}`,
    activity_log: (n) => `${n} activity`,
    customer_calls: (n) => `${n} call${n !== 1 ? 's' : ''}`,
    job_calls: (n) => `${n} job call${n !== 1 ? 's' : ''}`,
  };

  const parts = Object.entries(row_counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => (labels[k] ? labels[k](v) : `${v} ${k}`));

  return parts.length > 0 ? parts.join(', ') : 'No records moved';
}

/**
 * Format row_counts as full breakdown for tooltip.
 */
function formatRowCountsFull(row_counts) {
  if (!row_counts) return 'No data';
  return Object.entries(row_counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * MergesTable — admin table of customer_merge_audit rows.
 * D-19 expanded: shows every row — active, unmerged, and historical. Retained forever.
 *
 * @param {{ merges: Array, focus?: string }} props
 */
export default function MergesTable({ merges, focus }) {
  const router = useRouter();

  if (!merges || merges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <p className="text-sm font-medium text-foreground">No merges yet.</p>
        <p className="text-sm text-muted-foreground">
          When you merge a customer, it shows up here.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border overflow-hidden mt-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[160px]">When</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Merged by</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead>Records moved</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merges.map((merge) => {
              const isActive = !merge.unmerged_at;
              const sourceCustomer = merge.source_customer;
              const targetCustomer = merge.target_customer;

              return (
                <TableRow key={merge.id} className="hover:bg-muted/30 transition-colors">
                  {/* When */}
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(merge.merged_at)}
                  </TableCell>

                  {/* Source */}
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {sourceCustomer?.name || 'Unknown'}
                      </p>
                      {sourceCustomer?.phone_e164 && (
                        <p className="text-xs text-muted-foreground font-mono tabular-nums">
                          {sourceCustomer.phone_e164}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  {/* Target */}
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {targetCustomer?.name || 'Unknown'}
                      </p>
                      {targetCustomer?.phone_e164 && (
                        <p className="text-xs text-muted-foreground font-mono tabular-nums">
                          {targetCustomer.phone_e164}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  {/* Merged by */}
                  <TableCell className="text-sm text-muted-foreground">
                    {merge.merged_by_email || (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs font-mono text-muted-foreground/60 cursor-help">
                            {merge.merged_by
                              ? merge.merged_by.slice(0, 8) + '…'
                              : '—'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {merge.merged_by
                              ? `User ID: ${merge.merged_by}`
                              : 'Automated or service-role merge'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                        Active
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Unmerged {formatShortDate(merge.unmerged_at)}
                      </span>
                    )}
                  </TableCell>

                  {/* Records moved */}
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm text-foreground cursor-help underline decoration-dotted decoration-muted-foreground">
                          {formatRowCountsSummary(merge.row_counts)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{formatRowCountsFull(merge.row_counts)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {sourceCustomer?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => router.push(`/dashboard/customers/${sourceCustomer.id}`)}
                        >
                          View source
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                      {targetCustomer?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => router.push(`/dashboard/customers/${targetCustomer.id}`)}
                        >
                          View target
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
