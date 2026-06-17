/**
 * src/lib/jobs.js
 * Phase 59 Plan 04 — Business logic for the jobs entity.
 *
 * D-02a: This file writes EXCLUSIVELY to the jobs table (new schema).
 * Zero references to legacy leads / lead_calls tables.
 * D-06: Jobs always have appointment_id NOT NULL (1:1 with appointments).
 */

import { createSupabaseServer } from './supabase-server.js';
import { escapeOrTerm } from './search-filter.js';

// Valid job status values (059_customers_jobs_inquiries.sql CHECK constraint)
const VALID_JOB_STATUSES = ['scheduled', 'completed', 'paid', 'cancelled', 'lost'];
const VALID_URGENCIES = ['emergency', 'urgent', 'routine'];

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * List jobs for a tenant, optionally filtered by status / urgency / customer_id /
 * search (customer name or phone) / created_at date range.
 * Returns jobs with joined customer, appointment, and linked call data (D-06).
 *
 * NOTE: jobs has no job_type column (059) — a job-type filter cannot be applied here.
 *
 * @param {{ tenantId: string, status?: string, urgency?: string, customerId?: string,
 *           search?: string, dateFrom?: string, dateTo?: string }} opts
 * @returns {Promise<Array>}
 */
export async function listJobs({ tenantId, status, urgency, customerId, search, dateFrom, dateTo } = {}) {
  const supabase = await createSupabaseServer();

  let q = supabase
    .from('jobs')
    .select(`
      id, status, urgency, revenue_amount, is_vip, created_at, updated_at,
      customer:customers!inner(id, name, phone_e164, email, default_address),
      appointment:appointments!inner(id, start_time, end_time, service_address, status),
      calls:job_calls(call:calls(id, recording_url, duration_seconds, urgency_classification))
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) q = q.eq('status', status);
  if (urgency) q = q.eq('urgency', urgency);
  if (customerId) q = q.eq('customer_id', customerId);

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
 * Fetch a single job with joined customer + appointment + calls.
 *
 * @param {{ tenantId: string, jobId: string }} opts
 * @returns {Promise<object>}
 */
export async function getJob({ tenantId, jobId }) {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, status, urgency, revenue_amount, is_vip, created_at, updated_at,
      customer:customers!inner(id, name, phone_e164, email, default_address),
      appointment:appointments!inner(id, start_time, end_time, service_address, status),
      calls:job_calls(call:calls(id, recording_url, recording_storage_path, transcript_text, transcript_structured, duration_seconds, urgency_classification))
    `)
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;
  return data;
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update allowed job fields: status, urgency, revenue_amount, is_vip.
 * Status guarded to enum. Returns updated job row.
 *
 * @param {{ tenantId: string, jobId: string, patch: object }} opts
 * @returns {Promise<object>}
 */
export async function updateJob({ tenantId, jobId, patch }) {
  const { status, urgency, revenue_amount, is_vip } = patch;

  if (status !== undefined && !VALID_JOB_STATUSES.includes(status)) {
    const err = new Error(`invalid_status: must be one of ${VALID_JOB_STATUSES.join(', ')}`);
    err.code = 'invalid_status';
    throw err;
  }

  if (urgency !== undefined && !VALID_URGENCIES.includes(urgency)) {
    const err = new Error(`invalid_urgency: must be one of ${VALID_URGENCIES.join(', ')}`);
    err.code = 'invalid_urgency';
    throw err;
  }

  // Whitelist allowed fields
  const allowed = {};
  if (status !== undefined) allowed.status = status;
  if (urgency !== undefined) allowed.urgency = urgency;
  if (revenue_amount !== undefined) allowed.revenue_amount = revenue_amount;
  if (is_vip !== undefined) allowed.is_vip = is_vip;
  allowed.updated_at = new Date().toISOString();

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('jobs')
    .update(allowed)
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export { VALID_JOB_STATUSES, VALID_URGENCIES };
