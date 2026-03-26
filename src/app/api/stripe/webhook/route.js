import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { retell } from '@/lib/retell';
import twilio from 'twilio';

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

/**
 * Provision a phone number based on tenant's country.
 * SG: Assign from phone_inventory via atomic RPC.
 * US/CA: Purchase via Twilio API, then import into Retell (per D-12 — Twilio-direct for future SMS access).
 *
 * Returns the provisioned phone number string, or null on failure.
 */
async function provisionPhoneNumber(tenantId, country) {
  try {
    if (country === 'SG') {
      // Atomic assignment from pre-purchased inventory (D-11)
      const { data, error } = await supabase.rpc('assign_sg_number', {
        p_tenant_id: tenantId,
      });

      if (error) {
        console.error('[stripe/webhook] SG assignment RPC error:', error);
        return null;
      }

      // data is an array of { phone_number } rows; empty = no available numbers
      if (!data || data.length === 0) {
        console.warn('[stripe/webhook] No SG numbers available for tenant:', tenantId);
        return null;
      }

      return data[0].phone_number;
    } else if (country === 'US' || country === 'CA') {
      // Step 1: Purchase number via Twilio API (D-12 — direct Twilio, not Retell)
      // This gives us ownership of the number for future SMS capabilities
      const client = getTwilioClient();
      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumberType: 'local',
        countryCode: country,
      });
      const phoneNumber = purchasedNumber.phoneNumber; // E.164 format

      console.log(`[stripe/webhook] Purchased Twilio number ${phoneNumber} (${country}) for tenant ${tenantId}`);

      // Step 2: Import the Twilio-purchased number into Retell for voice AI
      // Retell needs the number imported with SIP trunk config to handle inbound calls
      try {
        await retell.phoneNumber.import({
          phone_number: phoneNumber,
          termination_uri: process.env.RETELL_SIP_TRUNK_TERMINATION_URI || undefined,
        });
        console.log(`[stripe/webhook] Imported ${phoneNumber} into Retell for tenant ${tenantId}`);
      } catch (importErr) {
        // Number is purchased but Retell import failed — log but still return the number
        // The number is usable; Retell import can be retried manually
        console.error(`[stripe/webhook] Retell import failed for ${phoneNumber}:`, importErr);
      }

      return phoneNumber;
    } else {
      // Fallback: treat as US (legacy behavior)
      console.warn('[stripe/webhook] Unknown country for tenant:', tenantId, country);
      const client = getTwilioClient();
      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumberType: 'local',
        countryCode: 'US',
      });
      const phoneNumber = purchasedNumber.phoneNumber;

      try {
        await retell.phoneNumber.import({ phone_number: phoneNumber });
      } catch (importErr) {
        console.error(`[stripe/webhook] Retell import failed for fallback ${phoneNumber}:`, importErr);
      }

      return phoneNumber;
    }
  } catch (err) {
    console.error('[stripe/webhook] Provisioning failed for tenant:', tenantId, err);
    return null;
  }
}

// Price ID -> plan mapping (D-12) — includes both monthly and annual prices
const PLAN_MAP = {
  [process.env.STRIPE_PRICE_STARTER]:        { plan_id: 'starter', calls_limit: 40 },
  [process.env.STRIPE_PRICE_STARTER_ANNUAL]: { plan_id: 'starter', calls_limit: 40 },
  [process.env.STRIPE_PRICE_GROWTH]:         { plan_id: 'growth',  calls_limit: 120 },
  [process.env.STRIPE_PRICE_GROWTH_ANNUAL]:  { plan_id: 'growth',  calls_limit: 120 },
  [process.env.STRIPE_PRICE_SCALE]:          { plan_id: 'scale',   calls_limit: 400 },
  [process.env.STRIPE_PRICE_SCALE_ANNUAL]:   { plan_id: 'scale',   calls_limit: 400 },
};

/**
 * Stripe webhook handler — processes all subscription lifecycle events.
 *
 * Design decisions:
 * - Raw body via request.text() for signature verification (D-06)
 * - Synchronous processing, no after() (D-08)
 * - Idempotency via stripe_webhook_events UNIQUE constraint (D-09)
 * - Out-of-order protection via stripe_updated_at comparison (D-10)
 * - History table pattern: mark prior rows inactive, insert new current row (D-13)
 */
export async function POST(request) {
  // 1. Raw body + signature verification (D-06)
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Idempotency check (D-09)
  const { error: idempotencyError } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type });

  if (idempotencyError?.code === '23505') {
    // Duplicate event — already processed
    return Response.json({ received: true });
  }

  if (idempotencyError) {
    console.error('[stripe/webhook] Idempotency insert error:', idempotencyError);
    // Continue processing — the event may still need handling
  }

  // 3. Event routing (D-08 — synchronous, no after())
  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object);
    } else if (event.type === 'customer.subscription.created') {
      await handleSubscriptionEvent(event.data.object);
    } else if (event.type === 'customer.subscription.updated') {
      await handleSubscriptionEvent(event.data.object);
    } else if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionEvent(event.data.object);
    } else if (event.type === 'customer.subscription.paused') {
      await handleSubscriptionEvent(event.data.object);
    } else if (event.type === 'customer.subscription.resumed') {
      await handleSubscriptionEvent(event.data.object);
    } else if (event.type === 'customer.subscription.trial_will_end') {
      await handleTrialWillEnd(event.data.object);
    } else if (event.type === 'invoice.paid') {
      await handleInvoicePaid(event.data.object);
    } else if (event.type === 'invoice.payment_failed') {
      await handleInvoicePaymentFailed(event.data.object);
    } else {
      // Unknown event type — log and return 200 (D-07)
      console.log('Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    // Return 500 so Stripe retries
    return Response.json({ error: 'Handler failed' }, { status: 500 });
  }

  // 4. Return success
  return Response.json({ received: true });
}

/**
 * Handle checkout.session.completed — marks onboarding complete and creates
 * the initial subscription row by delegating to handleSubscriptionEvent.
 */
async function handleCheckoutCompleted(session) {
  const tenantId = session.metadata?.tenant_id;
  if (!tenantId) {
    console.warn('[stripe/webhook] checkout.session.completed missing tenant_id in metadata');
    return;
  }

  // Set onboarding_complete = true on the tenant row
  const { error: tenantError } = await supabase
    .from('tenants')
    .update({ onboarding_complete: true })
    .eq('id', tenantId);

  if (tenantError) {
    console.error('[stripe/webhook] Failed to set onboarding_complete:', tenantError);
  }

  // Provision phone number based on tenant's country (Phase 27)
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('country, retell_phone_number')
    .eq('id', tenantId)
    .single();

  if (tenantRow && !tenantRow.retell_phone_number) {
    const provisionedNumber = await provisionPhoneNumber(tenantId, tenantRow.country);

    if (provisionedNumber) {
      await supabase
        .from('tenants')
        .update({ retell_phone_number: provisionedNumber })
        .eq('id', tenantId);
      console.log(`[stripe/webhook] Provisioned ${provisionedNumber} for tenant ${tenantId} (${tenantRow.country})`);
    } else {
      // Mark provisioning as failed for admin follow-up (Pitfall 4 from RESEARCH.md)
      await supabase
        .from('tenants')
        .update({ provisioning_failed: true })
        .eq('id', tenantId);
      console.error(`[stripe/webhook] Provisioning failed for tenant ${tenantId} (${tenantRow.country}) — flagged for admin`);
    }
  }

  // Retrieve the full subscription from Stripe and sync locally
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await handleSubscriptionEvent(subscription);
  }
}

/**
 * Core subscription sync — handles created/updated/deleted/paused/resumed events.
 * Implements out-of-order protection (D-10) and history table pattern (D-13).
 */
async function handleSubscriptionEvent(subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) {
    console.warn('[stripe/webhook] Subscription missing tenant_id in metadata:', subscription.id);
    return;
  }

  // Out-of-order protection (D-10)
  // Prefer .updated timestamp if present, fallback to .created
  const rawTimestamp = subscription.updated || subscription.created;
  const stripeUpdatedAt = new Date(rawTimestamp * 1000).toISOString();

  const { data: currentRow } = await supabase
    .from('subscriptions')
    .select('stripe_updated_at, calls_used')
    .eq('stripe_subscription_id', subscription.id)
    .eq('is_current', true)
    .maybeSingle();

  if (currentRow?.stripe_updated_at && currentRow.stripe_updated_at >= stripeUpdatedAt) {
    // Stale event — skip
    console.log('Skipping stale event for subscription:', subscription.id);
    return;
  }

  // Price-to-plan mapping (D-12)
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const planInfo = PLAN_MAP[priceId] || { plan_id: 'starter', calls_limit: 40 };

  // Status mapping (D-14) — map Stripe status to local status
  const statusMap = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    paused: 'paused',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    unpaid: 'past_due',
  };
  const localStatus = statusMap[subscription.status] || 'incomplete';

  // Carry forward calls_used from prior row (or 0 for new subscriptions)
  const callsUsed = currentRow?.calls_used ?? 0;

  // History table insert (D-13)
  // Step 1: Mark all existing rows for this subscription as not current
  await supabase
    .from('subscriptions')
    .update({ is_current: false })
    .eq('stripe_subscription_id', subscription.id)
    .eq('is_current', true);

  // Step 2: Insert new row with is_current = true
  const { error: insertError } = await supabase
    .from('subscriptions')
    .insert({
      tenant_id: tenantId,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId || null,
      plan_id: planInfo.plan_id,
      status: localStatus,
      calls_limit: planInfo.calls_limit,
      calls_used: callsUsed,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      stripe_updated_at: stripeUpdatedAt,
      is_current: true,
    });

  if (insertError) {
    console.error('[stripe/webhook] Failed to insert subscription row:', insertError);
    throw insertError;
  }

  console.log(`[stripe/webhook] Synced subscription ${subscription.id} status=${localStatus} plan=${planInfo.plan_id}`);
}

/**
 * Handle invoice.paid — reset calls_used on billing cycle renewal.
 * Only processes subscription_cycle invoices (not the first invoice).
 */
async function handleInvoicePaid(invoice) {
  if (invoice.billing_reason !== 'subscription_cycle') {
    return;
  }

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const { error } = await supabase
    .from('subscriptions')
    .update({ calls_used: 0 })
    .eq('stripe_subscription_id', subscriptionId)
    .eq('is_current', true);

  if (error) {
    console.error('[stripe/webhook] Failed to reset calls_used:', error);
    throw error;
  }

  console.log(`[stripe/webhook] Reset calls_used for subscription ${subscriptionId}`);
}

/**
 * Handle customer.subscription.trial_will_end — log for now.
 * Phase 24 will add notification logic.
 */
async function handleTrialWillEnd(subscription) {
  console.log('Trial ending soon for tenant:', subscription.metadata?.tenant_id);
}

/**
 * Handle invoice.payment_failed — log for now.
 * Phase 24 will add notification logic.
 */
async function handleInvoicePaymentFailed(invoice) {
  console.log('Payment failed for subscription:', invoice.subscription);
}
