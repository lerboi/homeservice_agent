/**
 * src/lib/inquiries.js
 * Phase 59 Plan 04 — Business logic for the inquiries entity.
 *
 * D-02a: This file writes EXCLUSIVELY to the inquiries table (new schema).
 * Zero references to legacy leads / lead_calls tables.
 * D-07: status 3-value enum: open, converted, lost.
 * D-07a: stale open inquiries stay open indefinitely — owner's responsibility.
 * D-10: conversion (inquiry → job) is handled via separate convert route; PATCH
 *       only allows open ↔ lost transitions.
 */

import { createSupabaseServer } from './supabase-server.js';
import { escapeOrTerm } from './search-filter.js';

// D-07: 3-state status enum
const VALID_INQUIRY_STATUSES = ['open', 'converted', 'lost'];
// PATCH-allowed statuses: conversion is via /convert route, not PATCH (D-10)
const PATCH_ALLOWED_STATUSES = ['open', 'lost'];

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * List inquiries for a tenant, joined with customer.
 * Optionally filtered by status / urgency / jobType / search (customer name or
 * phone) / created_at date range.
 *
 * @param {{ tenantId: string, status?: string, urgency?: string, jobType?: string,
 *           search?: string, dateFrom?: string, dateTo?: string }} opts
 * @returns {Promise<Array>}
 */
export async function listInquiries({ tenantId, status, urgency, jobType, search, dateFrom, dateTo } = {}) {
  const supabase = await createSupabaseServer();

  let q = supabase
    .from('inquiries')
    .select(`
      id, status, urgency, job_type, service_address, created_at, updated_at, converted_to_job_id,
      customer:customers!inner(id, name, phone_e164, default_address)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) q = q.eq('status', status);
  if (urgency) q = q.eq('urgency', urgency);
  if (jobType) q = q.ilike('job_type', `%${escapeOrTerm(jobType.trim())}%`);

  // Search by customer name or phone — the customers!inner join makes this
  // embedded or-filter behave as a parent-row filter (same pattern as listCustomers).
  if (search) {
    const s = escapeOrTerm(search.trim());
    q = q.or(`name.ilike.%${s}%,phone_e164.ilike.%${s}%`, { referencedTable: 'customer' });
  }

  if (dateFrom) q = q.gte('created_at', dateFrom);
  // Bare YYYY-MM-DD "to" date is inclusive of that whole day (UTC).
  if (dateTo) {
    q = q.lte('created_at', /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo}T23:59:59.999Z` : dateTo);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// ─── Detail ───────────────────────────────────────────────────────────────────

/**
 * Fetch a single inquiry with joined customer.
 *
 * @param {{ tenantId: string, inquiryId: string }} opts
 * @returns {Promise<object>}
 */
export async function getInquiry({ tenantId, inquiryId }) {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from('inquiries')
    .select(`
      id, status, urgency, job_type, service_address, created_at, updated_at, converted_to_job_id,
      customer:customers!inner(id, name, phone_e164, default_address)
    `)
    .eq('id', inquiryId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update inquiry status (open ↔ lost only).
 * D-10: conversion to 'converted' is NOT allowed via PATCH — use /convert route.
 *
 * @param {{ tenantId: string, inquiryId: string, patch: object }} opts
 * @returns {Promise<object>}
 */
export async function updateInquiry({ tenantId, inquiryId, patch }) {
  const { status } = patch;

  if (status !== undefined) {
    if (!VALID_INQUIRY_STATUSES.includes(status)) {
      const err = new Error(`invalid_status: must be one of ${VALID_INQUIRY_STATUSES.join(', ')}`);
      err.code = 'invalid_status';
      throw err;
    }
    // D-10: 'converted' is reserved for /convert route
    if (!PATCH_ALLOWED_STATUSES.includes(status)) {
      const err = new Error(`status_not_patchable: use /api/inquiries/:id/convert for conversion`);
      err.code = 'status_not_patchable';
      throw err;
    }
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('inquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', inquiryId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export { VALID_INQUIRY_STATUSES, PATCH_ALLOWED_STATUSES };
