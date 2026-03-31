/**
 * Pure guard functions for bidirectional invoice ↔ lead sync.
 *
 * These functions are intentionally pure (no DB calls, no side effects) so
 * they can be unit-tested without mocking infrastructure. The API routes
 * call these to decide whether to propagate a status change.
 *
 * Circular-update prevention:
 *   - Invoice PATCH sets sync_source='invoice_paid' on the lead PATCH request
 *   - Lead PATCH checks sync_source and skips invoice sync when coming from invoice
 */

/**
 * Decides whether an invoice status change should propagate to the linked lead.
 *
 * @param {string} invoiceStatus  - The new invoice status being applied
 * @param {string|null} leadId    - The lead_id on the invoice (null if unlinked)
 * @param {string|undefined} syncSource - sync_source from the PATCH body (set by lead route to prevent circles)
 * @returns {boolean}
 */
export function shouldSyncToLead(invoiceStatus, leadId, syncSource) {
  return invoiceStatus === 'paid' && leadId != null && syncSource !== 'lead_paid';
}

/**
 * Decides whether a lead status change should propagate to a linked invoice.
 *
 * @param {string} leadStatus      - The new lead status being applied
 * @param {string|undefined} syncSource - sync_source from the PATCH body (set by invoice route to prevent circles)
 * @returns {boolean}
 */
export function shouldSyncToInvoice(leadStatus, syncSource) {
  return leadStatus === 'paid' && syncSource !== 'invoice_paid';
}
