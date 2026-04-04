import { supabase } from '@/lib/supabase.js';

/**
 * Atomically book a slot by calling the book_appointment_atomic Supabase RPC.
 *
 * The RPC function acquires a non-blocking advisory lock keyed on (tenant_id, slot_start),
 * checks for overlapping confirmed/completed appointments, and inserts the new row.
 *
 * Returns the RPC result data on success.
 * Throws on Supabase transport/query error.
 *
 * @param {object} params
 * @param {string}      params.tenantId    - UUID of the tenant
 * @param {string|null} params.callId      - UUID of the originating call (nullable)
 * @param {Date}        params.startTime   - Slot start (UTC Date object)
 * @param {Date}        params.endTime     - Slot end (UTC Date object)
 * @param {string}      params.address     - Service address (verbally confirmed by caller)
 * @param {string}      params.callerName  - Caller's full name
 * @param {string}      params.callerPhone - Caller's phone number
 * @param {string}      params.urgency     - 'emergency' | 'routine' | 'urgent'
 * @param {string|null} params.zoneId      - Service zone UUID (nullable)
 * @returns {Promise<object>} RPC result: { success: boolean, appointment_id?: string, reason?: string }
 */
export async function atomicBookSlot({
  tenantId,
  callId,
  startTime,
  endTime,
  address,
  callerName,
  callerPhone,
  urgency,
  zoneId,
}) {
  const { data, error } = await supabase.rpc('book_appointment_atomic', {
    p_tenant_id:       tenantId,
    p_call_id:         callId,
    p_start_time:      startTime.toISOString(),
    p_end_time:        endTime.toISOString(),
    p_service_address: address,
    p_caller_name:     callerName,
    p_caller_phone:    callerPhone,
    p_urgency:         urgency,
    p_zone_id:         zoneId || null,
  });

  if (error) {
    throw error;
  }

  return data;
}
