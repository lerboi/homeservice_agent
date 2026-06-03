/**
 * Pure guard functions for bidirectional invoice ↔ job sync.
 *
 * These functions are intentionally pure (no DB calls, no side effects) so
 * they can be unit-tested without mocking infrastructure. The API routes
 * call these to decide whether to propagate a status change.
 *
 * Circular-update prevention:
 *   - Invoice PATCH sets sync_source='invoice_paid' on the job PATCH request
 *   - Job PATCH checks sync_source and skips invoice sync when coming from invoice
 */

/**
 * Decides whether an invoice status change should propagate to the linked job.
 *
 * @param {string} invoiceStatus  - The new invoice status being applied
 * @param {string|null} jobId     - The job_id on the invoice (null if unlinked)
 * @param {string|undefined} syncSource - sync_source from the PATCH body (set by job route to prevent circles)
 * @returns {boolean}
 */
export function shouldSyncToJob(invoiceStatus, jobId, syncSource) {
  return invoiceStatus === 'paid' && jobId != null && syncSource !== 'job_paid';
}

/**
 * Decides whether a job status change should propagate to a linked invoice.
 *
 * @param {string} jobStatus       - The new job status being applied
 * @param {string|undefined} syncSource - sync_source from the PATCH body (set by invoice route to prevent circles)
 * @returns {boolean}
 */
export function shouldSyncToInvoice(jobStatus, syncSource) {
  return jobStatus === 'paid' && syncSource !== 'invoice_paid';
}
