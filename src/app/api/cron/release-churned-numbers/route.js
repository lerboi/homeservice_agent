import { supabase } from '@/lib/supabase';
import twilio from 'twilio';

/**
 * Release phone numbers for churned tenants (2026-06-12 audit H5).
 *
 * Before this cron, numbers were NEVER released on churn: every canceled
 * US/CA tenant kept costing Twilio rent (~$1.15/mo) forever, and canceled SG
 * tenants permanently consumed rows from the finite phone_inventory pool.
 *
 * Eligibility: the tenant's CURRENT subscription row is 'canceled' and the
 * cancellation is older than the 30-day retention window. The retention
 * window means a tenant who reactivates within 30 days keeps their number
 * (re-subscribing replaces the is_current row with an active one, which
 * drops them out of this query entirely).
 *
 * Per country:
 *   SG    — return the number to phone_inventory (status 'available',
 *           assigned_tenant_id cleared). The platform owns SG numbers; they
 *           are never released at Twilio.
 *   other — look the number up at Twilio by E.164 and release it (releasing
 *           also detaches it from the Elastic SIP trunk).
 *
 * Either way tenants.phone_number is cleared so the LiveKit webhook stops
 * resolving calls to the churned tenant.
 */

const RETENTION_DAYS = 30;
const BATCH_LIMIT = 10;

let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

export async function GET(request) {
  // Auth guard — same pattern as other crons
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Current-row-canceled tenants past retention, that still hold a number.
  const { data: rows, error: queryError } = await supabase
    .from('subscriptions')
    .select('tenant_id, status, stripe_updated_at, created_at, tenants!inner(id, phone_number, country, business_name)')
    .eq('is_current', true)
    .eq('status', 'canceled')
    .not('tenants.phone_number', 'is', null)
    .limit(BATCH_LIMIT * 5);

  if (queryError) {
    console.error('[release-numbers] Query error:', queryError.message);
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  // stripe_updated_at is the cancellation event time; fall back to the row's
  // created_at (when the webhook wrote the canceled row) when it's missing.
  const eligible = (rows || [])
    .filter((r) => (r.stripe_updated_at || r.created_at) < cutoff)
    .slice(0, BATCH_LIMIT);

  const results = { released: 0, returned_to_inventory: 0, failed: 0, skipped: rows ? rows.length - eligible.length : 0 };

  for (const row of eligible) {
    const tenant = row.tenants;
    const phoneNumber = tenant.phone_number;
    try {
      if (tenant.country === 'SG') {
        // Return to the platform inventory pool.
        const { error: invError } = await supabase
          .from('phone_inventory')
          .update({ status: 'available', assigned_tenant_id: null })
          .eq('assigned_tenant_id', tenant.id)
          .eq('status', 'assigned');
        if (invError) throw invError;
        results.returned_to_inventory += 1;
      } else {
        // US/CA — release at Twilio. The SID was never persisted at purchase,
        // so look the number up by E.164 first.
        const client = getTwilioClient();
        const numbers = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
        if (numbers.length > 0) {
          await client.incomingPhoneNumbers(numbers[0].sid).remove();
          results.released += 1;
        } else {
          // Already gone at Twilio (released manually) — just clear the DB.
          console.warn(`[release-numbers] ${phoneNumber} not found at Twilio for tenant ${tenant.id}; clearing DB only`);
        }
      }

      const { error: clearError } = await supabase
        .from('tenants')
        .update({ phone_number: null })
        .eq('id', tenant.id);
      if (clearError) throw clearError;

      console.log(`[release-numbers] Released ${phoneNumber} (tenant ${tenant.id}, ${tenant.country})`);
    } catch (err) {
      // Per-tenant isolation: one failure must not block the rest of the batch.
      results.failed += 1;
      console.error(`[release-numbers] Failed for tenant ${tenant.id} (${phoneNumber}):`, err.message);
    }
  }

  return Response.json({ ok: true, ...results });
}
