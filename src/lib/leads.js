import { supabase } from '@/lib/supabase';

/**
 * createOrAttachLeadForManualAppointment — links a manual calendar booking to a lead.
 *
 * Unlike createOrMergeLead (voice-pipeline path), this helper:
 *  - never touches lead_calls (there is no call)
 *  - always treats the lead as 'booked' status (an appointment exists)
 *  - updates the existing lead's appointment_id to the newest booking for repeat callers
 *
 * Dedup rule matches the voice pipeline: same tenant + same from_number with
 * open status (new|booked) => attach; otherwise create.
 */
export async function createOrAttachLeadForManualAppointment({
  tenantId,
  appointmentId,
  fromNumber,
  callerName,
  jobType,
  serviceAddress,
  postalCode,
  streetName,
  email,
}) {
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, caller_name, status')
    .eq('tenant_id', tenantId)
    .eq('from_number', fromNumber)
    .in('status', ['new', 'booked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLead) {
    const updates = { appointment_id: appointmentId };
    if (existingLead.status === 'new') updates.status = 'booked';
    const { data: updated } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', existingLead.id)
      .eq('tenant_id', tenantId)
      .select('id, caller_name, status')
      .single();
    return updated || existingLead;
  }

  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      from_number: fromNumber,
      caller_name: callerName || null,
      job_type: jobType || null,
      service_address: serviceAddress || null,
      postal_code: postalCode || null,
      street_name: streetName || null,
      email: email || null,
      urgency: 'routine',
      status: 'booked',
      appointment_id: appointmentId,
      primary_call_id: null,
    })
    .select('id, caller_name, status')
    .single();

  if (error) {
    console.error('[appointments] createOrAttachLead insert error:', error);
    throw error;
  }

  await supabase.from('activity_log').insert({
    tenant_id: tenantId,
    event_type: 'lead_created',
    lead_id: newLead.id,
    metadata: {
      caller_name: callerName || null,
      job_type: jobType || null,
      source: 'manual_calendar',
    },
  });

  return newLead;
}

/**
 * createOrMergeLead — creates a new lead or attaches a repeat caller to an existing open lead.
 *
 * Pipeline rules:
 *  - Calls under 15 seconds are ignored (return null)
 *  - If an open lead (status: new|booked) exists for this caller, attach the call to it
 *  - If no open lead exists (caller is new, or prior jobs are completed/paid/lost), create a new lead
 *  - New lead status is 'booked' when an appointmentId is provided, otherwise 'new'
 *  - Every new lead creation logs an activity_log entry with event_type 'lead_created'
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.callId
 * @param {string} params.fromNumber
 * @param {string} [params.callerName]
 * @param {string} [params.jobType]
 * @param {string} [params.serviceAddress]
 * @param {{ urgency?: string }} params.triageResult
 * @param {string|null} [params.appointmentId]
 * @param {number} params.callDuration  — duration in seconds
 * @returns {Promise<object|null>}  created/existing lead, or null if call was too short
 */
export async function createOrMergeLead({
  tenantId,
  callId,
  fromNumber,
  callerName,
  jobType,
  serviceAddress,
  triageResult,
  appointmentId,
  callDuration,
}) {
  // 1. Short call filter — voicemails, mis-dials, etc.
  if (callDuration < 15) {
    return null;
  }

  // 2. Look for an existing open lead for this caller (new or booked only)
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('from_number', fromNumber)
    .in('status', ['new', 'booked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLead) {
    // 3. Repeat caller — attach this call to the existing open lead.
    // Upsert with ignoreDuplicates because mid-call capture_lead and the
    // post-call pipeline can both route here for the same (lead, call) pair.
    await supabase.from('lead_calls').upsert(
      { lead_id: existingLead.id, call_id: callId },
      { onConflict: 'lead_id,call_id', ignoreDuplicates: true },
    );
    return existingLead;
  }

  // 4. New lead — caller is new or all prior leads are closed
  const newLeadStatus = appointmentId ? 'booked' : 'new';
  const urgency = triageResult?.urgency || 'routine';

  const { data: insertedLeads, error } = await supabase.from('leads').insert([
    {
      tenant_id: tenantId,
      from_number: fromNumber,
      caller_name: callerName || null,
      job_type: jobType || null,
      service_address: serviceAddress || null,
      urgency,
      status: newLeadStatus,
      primary_call_id: callId,
      appointment_id: appointmentId || null,
    },
  ]).select('id, status, from_number, urgency, caller_name, job_type');

  if (error) {
    console.error('createOrMergeLead: insert error', error);
    throw error;
  }

  const newLead = insertedLeads?.[0];

  // 5. Insert into lead_calls junction (upsert for idempotency — see step 3 rationale)
  await supabase.from('lead_calls').upsert(
    { lead_id: newLead.id, call_id: callId },
    { onConflict: 'lead_id,call_id', ignoreDuplicates: true },
  );

  // 6. Log activity for new lead creation
  await supabase.from('activity_log').insert({
    tenant_id: tenantId,
    event_type: 'lead_created',
    lead_id: newLead.id,
    metadata: {
      caller_name: callerName || null,
      job_type: jobType || null,
      urgency,
    },
  });

  return newLead;
}

/**
 * getLeads — fetch leads for a tenant with joined call data and optional filters.
 *
 * Performance notes (per RESEARCH.md Pitfall 4):
 *  - transcript_text is intentionally excluded from the list query
 *  - Results ordered by created_at DESC (newest first)
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} [params.status]      — filter by lead status
 * @param {string} [params.urgency]     — filter by urgency
 * @param {string} [params.dateFrom]    — ISO timestamp, inclusive lower bound on created_at
 * @param {string} [params.dateTo]      — ISO timestamp, inclusive upper bound on created_at
 * @param {string} [params.search]      — ilike search on caller_name and from_number
 * @param {string} [params.jobType]     — filter by job_type
 * @returns {Promise<Array>}
 */
export async function getLeads({
  tenantId,
  status,
  urgency,
  dateFrom,
  dateTo,
  search,
  jobType,
} = {}) {
  // Base query — join calls via lead_calls junction, exclude transcript_text for performance
  let query = supabase
    .from('leads')
    .select(
      'id, tenant_id, from_number, caller_name, job_type, service_address, urgency, status, ' +
      'revenue_amount, primary_call_id, appointment_id, created_at, updated_at, ' +
      'calls!lead_calls(id, urgency_classification, urgency_confidence, recording_url, duration_seconds, from_number, start_timestamp)'
    )
    .eq('tenant_id', tenantId);

  // Conditional filters
  if (status) query = query.eq('status', status);
  if (urgency) query = query.eq('urgency', urgency);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (jobType) query = query.eq('job_type', jobType);
  if (search) {
    query = query.or(`caller_name.ilike.%${search}%,from_number.ilike.%${search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('getLeads: query error', error);
    throw error;
  }

  return data;
}
