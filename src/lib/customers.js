/**
 * src/lib/customers.js
 * Phase 59 Plan 04 — Business logic for the customers entity.
 *
 * D-02a: This file writes EXCLUSIVELY to the customers table (new schema).
 * Zero references to legacy leads / lead_calls tables.
 * D-05: phone_e164 is immutable — updateCustomer rejects any attempt to change it.
 * D-18: updateCustomer allows name, default_address, email, notes, tags only.
 * D-19: mergeCustomer / unmergeCustomer call Plan 03 RPCs via service-role client.
 * T-59-04-07: listCustomers adds .limit(200) to prevent unbounded list DoS.
 */

import { createSupabaseServer } from './supabase-server.js';
import { supabase as serviceClient } from './supabase.js';
import { getTenantFeatures } from './features.js';

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * List customers for a tenant, excluding merged (soft-deleted) rows.
 * Optionally filters by name or phone via case-insensitive ILIKE.
 *
 * T-59-04-07: Hard limit of 200 rows. Pagination is a follow-up (plan-level note).
 *
 * @param {{ tenantId: string, search?: string }} opts
 * @returns {Promise<Array>}
 */
export async function listCustomers({ tenantId, search }) {
  const supabase = await createSupabaseServer();
  let q = supabase
    .from('customers')
    .select(`
      id, name, phone_e164, default_address, email, tags, created_at, updated_at,
      jobs:jobs(count),
      open_inquiries:inquiries(count)
    `)
    .eq('tenant_id', tenantId)
    .is('merged_into', null)
    .order('updated_at', { ascending: false })
    .limit(200); // T-59-04-07: bounded list

  if (search) {
    const s = search.trim();
    q = q.or(`name.ilike.%${s}%,phone_e164.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// ─── Detail ───────────────────────────────────────────────────────────────────

/**
 * Fetch a single customer + live-computed aggregate stats.
 * Stats are computed inline (no denormalized column) per RESEARCH Pitfall 3.
 *
 * outstanding_balance is only computed when features_enabled.invoicing = true (D-17).
 *
 * @param {{ tenantId: string, customerId: string }} opts
 * @returns {Promise<{ customer: object, stats: object }>}
 */
export async function getCustomerWithStats({ tenantId, customerId }) {
  const supabase = await createSupabaseServer();

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .is('merged_into', null)
    .single();

  if (cErr) throw cErr;
  if (!customer) throw new Error('customer_not_found');

  const stats = await computeStatsInline({ tenantId, customerId, supabase });
  return { customer, stats };
}

/**
 * Compute customer aggregate stats inline (no RPC dependency).
 * outstanding_balance only populated when invoicing flag is ON.
 *
 * @private
 */
async function computeStatsInline({ tenantId, customerId, supabase }) {
  const [jobsRes, openInqRes, features] = await Promise.all([
    supabase
      .from('jobs')
      .select('revenue_amount, status')
      .eq('customer_id', customerId),
    supabase
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'open'),
    getTenantFeatures(tenantId),
  ]);

  const jobsData = jobsRes.data ?? [];
  const lifetime_value = jobsData
    .filter((j) => j.status === 'paid' || j.status === 'completed')
    .reduce((sum, j) => sum + Number(j.revenue_amount ?? 0), 0);

  let outstanding_balance = null;
  if (features.invoicing) {
    // Compute outstanding_balance from unpaid invoices linked to this customer's jobs
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('amount_due, status')
      .in(
        'job_id',
        jobsData.map((j) => j.id).filter(Boolean),
      );
    outstanding_balance = (invoiceData ?? [])
      .filter((inv) => ['sent', 'overdue', 'partially_paid'].includes(inv.status))
      .reduce((sum, inv) => sum + Number(inv.amount_due ?? 0), 0);
  }

  return {
    lifetime_value,
    outstanding_balance,
    jobs_count: jobsData.length,
    open_inquiries_count: openInqRes.count ?? 0,
  };
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update allowed customer fields.
 * Rejects phone_e164 and other immutable/dangerous fields (D-05, D-18, T-59-04-02, T-59-04-04).
 *
 * @param {{ tenantId: string, customerId: string, patch: object }} opts
 * @returns {Promise<object>} updated customer row
 */
export async function updateCustomer({ tenantId, customerId, patch }) {
  // D-05 + D-18 + T-59-04-02: reject immutable / dangerous fields
  const FORBIDDEN = ['phone_e164', 'tenant_id', 'id', 'merged_into', 'merged_at', 'merge_snapshot'];
  for (const k of FORBIDDEN) {
    if (k in patch) {
      const err = new Error(`field_not_editable: ${k}`);
      err.field = k;
      throw err;
    }
  }

  // T-59-04-04: whitelist — only these 5 fields are accepted (mass-assignment guard)
  const allowed = {};
  const ALLOWED_KEYS = ['name', 'default_address', 'email', 'notes', 'tags'];
  for (const k of ALLOWED_KEYS) {
    if (k in patch) allowed[k] = patch[k];
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('customers')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .is('merged_into', null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Merge (D-19 + D-19 expanded) ────────────────────────────────────────────

/**
 * Merge source customer into target.
 * Defense-in-depth: verifies both belong to caller's tenant before calling RPC.
 * Passes caller's user id as p_merged_by so the audit row records who merged (T-59-04-09).
 *
 * @param {{ tenantId: string, sourceId: string, targetId: string, mergedBy?: string|null }} opts
 * @returns {Promise<{ source_id, target_id, audit_id, moved_counts }>}
 */
export async function mergeCustomer({ tenantId, sourceId, targetId, mergedBy = null }) {
  const supabase = await createSupabaseServer();

  // T-59-03-02 / T-59-04-03: verify both customers belong to caller's tenant
  const [{ data: source }, { data: target }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, tenant_id')
      .eq('id', sourceId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('customers')
      .select('id, tenant_id')
      .eq('id', targetId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (!source || !target) {
    throw new Error('not_found_or_cross_tenant');
  }

  // Call merge_customer RPC via service-role client (SECURITY DEFINER — requires service_role)
  const { data, error } = await serviceClient.rpc('merge_customer', {
    p_tenant_id: tenantId,
    p_source_id: sourceId,
    p_target_id: targetId,
    p_merged_by: mergedBy, // D-19 expanded — auth.uid() propagated for audit (T-59-04-09)
  });

  if (error) throw error;
  return data; // { source_id, target_id, audit_id, moved_counts }
}

// ─── Unmerge (D-19 7-day undo) ───────────────────────────────────────────────

/**
 * Unmerge a previously merged customer within the 7-day window.
 * merge_window_expired → caller maps to 410 Gone.
 * not_merged → caller maps to 404.
 *
 * @param {{ tenantId: string, sourceId: string }} opts
 * @returns {Promise<{ source_id, restored_from, audit_id }>}
 */
export async function unmergeCustomer({ tenantId, sourceId }) {
  const { data, error } = await serviceClient.rpc('unmerge_customer', {
    p_tenant_id: tenantId,
    p_source_id: sourceId,
  });

  if (error) throw error;
  return data; // { source_id, restored_from, audit_id }
}
