import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import twilio from 'twilio';
import { Resend } from 'resend';
import { PaymentFailedEmail } from '@/emails/PaymentFailedEmail';
import { TrialReminderEmail } from '@/emails/TrialReminderEmail';

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

let resendClient = null;
function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Provision a phone number based on tenant's country.
 * SG: Assign from phone_inventory via atomic RPC.
 * US/CA: Purchase via Twilio API. Number routes via Twilio Elastic SIP trunk to LiveKit.
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

      const phoneNumber = data[0].phone_number;

      // Associate SG number with the Elastic SIP trunk so calls route to LiveKit
      if (process.env.TWILIO_SIP_TRUNK_SID) {
        try {
          const client = getTwilioClient();
          // Look up the number's SID from Twilio by phone number
          const numbers = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
          if (numbers.length > 0) {
            await client.trunking.v1
              .trunks(process.env.TWILIO_SIP_TRUNK_SID)
              .phoneNumbers.create({ phoneNumberSid: numbers[0].sid });
            console.log(`[stripe/webhook] Associated SG ${phoneNumber} with SIP trunk`);
          }
        } catch (trunkErr) {
          console.error(`[stripe/webhook] SIP trunk association failed for SG ${phoneNumber}:`, trunkErr);
        }
      }

      return phoneNumber;
    } else if (country === 'US' || country === 'CA') {
      // Purchase number via Twilio API
      // Number routes via Twilio Elastic SIP trunk to LiveKit (no Retell import needed)
      const client = getTwilioClient();
      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumberType: 'local',
        countryCode: country,
      });
      const phoneNumber = purchasedNumber.phoneNumber; // E.164 format
      const numberSid = purchasedNumber.sid;

      console.log(`[stripe/webhook] Purchased Twilio number ${phoneNumber} (${country}) for tenant ${tenantId}`);

      // Associate number with the Elastic SIP trunk so calls route to LiveKit
      if (process.env.TWILIO_SIP_TRUNK_SID) {
        try {
          await client.trunking.v1
            .trunks(process.env.TWILIO_SIP_TRUNK_SID)
            .phoneNumbers.create({ phoneNumberSid: numberSid });
          console.log(`[stripe/webhook] Associated ${phoneNumber} with SIP trunk`);
        } catch (trunkErr) {
          // Non-fatal: number is purchased, trunk association can be done manually
          console.error(`[stripe/webhook] SIP trunk association failed for ${phoneNumber}:`, trunkErr);
        }
      }

      return phoneNumber;
    } else {
      // Unknown or null country — flag for admin instead of provisioning wrong country
      console.error('[stripe/webhook] Cannot provision: unknown country for tenant:', tenantId, country);
      return null;
    }
  } catch (err) {
    console.error('[stripe/webhook] Provisioning failed for tenant:', tenantId, err);
    return null;
  }
}

// Price ID -> plan mapping (D-12) — includes monthly, annual, and overage prices
const PLAN_MAP = {
  [process.env.STRIPE_PRICE_STARTER]:        { plan_id: 'starter', calls_limit: 40 },
  [process.env.STRIPE_PRICE_STARTER_ANNUAL]: { plan_id: 'starter', calls_limit: 480 },
  [process.env.STRIPE_PRICE_GROWTH]:         { plan_id: 'growth',  calls_limit: 120 },
  [process.env.STRIPE_PRICE_GROWTH_ANNUAL]:  { plan_id: 'growth',  calls_limit: 1440 },
  [process.env.STRIPE_PRICE_SCALE]:          { plan_id: 'scale',   calls_limit: 400 },
  [process.env.STRIPE_PRICE_SCALE_ANNUAL]:   { plan_id: 'scale',   calls_limit: 4800 },
};

// Overage metered price IDs — used to identify the metered subscription item
const OVERAGE_PRICE_IDS = new Set([
  process.env.STRIPE_PRICE_STARTER_OVERAGE,
  process.env.STRIPE_PRICE_GROWTH_OVERAGE,
  process.env.STRIPE_PRICE_SCALE_OVERAGE,
].filter(Boolean));

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
    // DB error (not duplicate) — return 500 so Stripe retries after DB recovers
    return Response.json({ error: 'Idempotency check failed' }, { status: 500 });
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

  console.log('[stripe/webhook] checkout.session.completed:', { tenantId, subscriptionId: session.subscription });

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
    .select('country, phone_number, owner_email, owner_phone, business_name')
    .eq('id', tenantId)
    .single();

  if (tenantRow && !tenantRow.phone_number) {
    const provisionedNumber = await provisionPhoneNumber(tenantId, tenantRow.country);

    if (provisionedNumber) {
      await supabase
        .from('tenants')
        .update({ phone_number: provisionedNumber })
        .eq('id', tenantId);
      console.log(`[stripe/webhook] Provisioned ${provisionedNumber} for tenant ${tenantId} (${tenantRow.country})`);
    } else {
      // Mark provisioning as failed for admin follow-up (Pitfall 4 from RESEARCH.md)
      await supabase
        .from('tenants')
        .update({ provisioning_failed: true })
        .eq('id', tenantId);
      console.error(`[stripe/webhook] Provisioning failed for tenant ${tenantId} (${tenantRow.country}) — flagged for admin`);

      // Notify the business owner about the provisioning failure
      if (tenantRow.owner_email) {
        try {
          await getResendClient().emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'support@voco.live',
            to: tenantRow.owner_email,
            subject: 'Action needed: Phone number setup requires attention',
            html: `<p>Hi${tenantRow.business_name ? ` ${tenantRow.business_name}` : ''},</p>
<p>Your Voco account is almost ready, but we couldn't automatically assign a phone number for your region (${tenantRow.country || 'unknown'}).</p>
<p>Our team has been notified and will resolve this shortly. If you need immediate assistance, reply to this email.</p>
<p>— The Voco Team</p>`,
          });
          console.log(`[stripe/webhook] Provisioning failure notification sent to ${tenantRow.owner_email}`);
        } catch (emailErr) {
          console.error('[stripe/webhook] Failed to send provisioning failure email:', emailErr?.message);
        }
      }
    }
  }

  // Add metered overage price to the subscription.
  // This can't be done in the Checkout Session because Checkout doesn't allow
  // mixing line items with different billing intervals (flat-rate annual + metered monthly).
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    // Determine the overage price for this plan
    const flatRateItem = subscription.items?.data?.find((item) => PLAN_MAP[item.price?.id]);
    const priceId = flatRateItem?.price?.id;
    const planKey = Object.entries({
      [process.env.STRIPE_PRICE_STARTER]: 'starter',
      [process.env.STRIPE_PRICE_STARTER_ANNUAL]: 'starter',
      [process.env.STRIPE_PRICE_GROWTH]: 'growth',
      [process.env.STRIPE_PRICE_GROWTH_ANNUAL]: 'growth',
      [process.env.STRIPE_PRICE_SCALE]: 'scale',
      [process.env.STRIPE_PRICE_SCALE_ANNUAL]: 'scale',
    }).find(([key]) => key === priceId)?.[1];

    const OVERAGE_MAP = {
      starter: process.env.STRIPE_PRICE_STARTER_OVERAGE,
      growth: process.env.STRIPE_PRICE_GROWTH_OVERAGE,
      scale: process.env.STRIPE_PRICE_SCALE_OVERAGE,
    };
    const overagePriceId = planKey ? OVERAGE_MAP[planKey] : null;

    // Only add if overage price exists and isn't already on the subscription
    const hasOverage = subscription.items?.data?.some((item) => OVERAGE_PRICE_IDS.has(item.price?.id));
    if (overagePriceId && !hasOverage) {
      try {
        await stripe.subscriptionItems.create(
          { subscription: subscription.id, price: overagePriceId },
          { idempotencyKey: `add_overage_${subscription.id}` },
        );
        console.log(`[stripe/webhook] Added overage item (${overagePriceId}) to subscription ${subscription.id}`);
      } catch (overageErr) {
        // Non-fatal: subscription works without overage, admin can add manually
        console.error(`[stripe/webhook] Failed to add overage item to subscription ${subscription.id}:`, overageErr.message);
      }
    }

    // Re-retrieve subscription with the overage item included
    const updatedSubscription = await stripe.subscriptions.retrieve(session.subscription);
    await handleSubscriptionEvent(updatedSubscription);
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

  if (currentRow?.stripe_updated_at) {
    if (currentRow.stripe_updated_at > stripeUpdatedAt) {
      // Stale event — skip
      console.log('[stripe/webhook] Skipping stale event for subscription:', subscription.id);
      return;
    }
    if (currentRow.stripe_updated_at === stripeUpdatedAt) {
      // Duplicate event with same timestamp — skip to prevent double rows
      console.log('[stripe/webhook] Skipping duplicate event for subscription:', subscription.id);
      return;
    }
  }

  // Price-to-plan mapping (D-12)
  // With overage metered pricing, subscription.items.data has 2 entries (flat-rate + metered).
  // Find the flat-rate item by matching against PLAN_MAP keys (not by index).
  const subscriptionItems = subscription.items?.data || [];
  const flatRateItem = subscriptionItems.find((item) => PLAN_MAP[item.price?.id]);
  const overageItem = subscriptionItems.find((item) => OVERAGE_PRICE_IDS.has(item.price?.id));

  const priceId = flatRateItem?.price?.id;
  if (priceId && !PLAN_MAP[priceId]) {
    console.error(`[stripe/webhook] Unknown price ID: ${priceId} for subscription ${subscription.id} — defaulting to starter`);
  }
  const planInfo = PLAN_MAP[priceId] || { plan_id: 'starter', calls_limit: 40 };
  const overageStripeItemId = overageItem?.id || null;

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
  // Insert new row first, THEN mark old rows inactive to avoid a window with zero current rows.
  // Brief window with 2 is_current rows is safer than 0 (proxy uses order+limit to pick latest).
  const { data: newRow, error: insertError } = await supabase
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
      overage_stripe_item_id: overageStripeItemId,
      is_current: true,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[stripe/webhook] Failed to insert subscription row:', insertError);
    throw insertError;
  }

  // Now mark all OTHER rows for this subscription as not current
  await supabase
    .from('subscriptions')
    .update({ is_current: false })
    .eq('stripe_subscription_id', subscription.id)
    .eq('is_current', true)
    .neq('id', newRow.id);

  console.log(`[stripe/webhook] Synced subscription ${subscription.id} status=${localStatus} plan=${planInfo.plan_id}`);

  // Clear billing_notifications on cancellation so future re-subscriptions get fresh notifications
  if (localStatus === 'canceled') {
    supabase
      .from('billing_notifications')
      .delete()
      .eq('tenant_id', tenantId)
      .then(({ error: delError }) => {
        if (delError) {
          console.error('[stripe/webhook] Failed to clear billing_notifications for tenant:', tenantId, delError);
        } else {
          console.log('[stripe/webhook] Cleared billing_notifications for canceled tenant:', tenantId);
        }
      });
  }
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
 * Handle customer.subscription.trial_will_end — send email + SMS notification.
 * Phase 24: BILLNOTIF-03
 * Idempotency via billing_notifications table (D-07).
 * Notification failures are logged but never thrown (Pitfall 3 in RESEARCH.md).
 */
async function handleTrialWillEnd(subscription) {
  try {
    const tenantId = subscription.metadata?.tenant_id;
    if (!tenantId) {
      console.warn('[stripe/webhook] handleTrialWillEnd: missing tenant_id in metadata');
      return;
    }

    // Idempotency check — prevent duplicate notifications on Stripe retries (Pitfall 4)
    const { data: existing } = await supabase
      .from('billing_notifications')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('notification_type', 'trial_will_end')
      .maybeSingle();

    if (existing) {
      console.log('[stripe/webhook] Trial-will-end already sent for tenant:', tenantId);
      return;
    }

    // Lookup tenant for owner contact info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, owner_email, owner_phone')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      console.warn('[stripe/webhook] handleTrialWillEnd: tenant not found:', tenantId);
      return;
    }

    // Lookup subscription for usage stats
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('calls_used, calls_limit, trial_ends_at')
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .maybeSingle();

    const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/more/billing`;

    // Send email + SMS via Promise.allSettled — failures logged, never thrown (Pitfall 3)
    const [emailResult, smsResult] = await Promise.allSettled([
      getResendClient().emails.send({
        from: 'Voco <notifications@voco.live>',
        to: tenant.owner_email,
        subject: 'Your Voco trial ends in 3 days',
        react: TrialReminderEmail({
          businessName: tenant.business_name,
          daysUsed: 11,
          daysRemaining: 3,
          callsUsed: sub?.calls_used || 0,
          callsLimit: sub?.calls_limit || 0,
          upgradeUrl,
        }),
      }),
      getTwilioClient().messages.create({
        body: `Voco: Your trial ends in 3 days. Upgrade now to keep your calls answered: ${upgradeUrl}`,
        to: tenant.owner_phone,
        from: process.env.TWILIO_FROM_NUMBER,
      }),
    ]);

    const emailStatus = emailResult.status === 'fulfilled' ? 'ok' : `failed: ${emailResult.reason?.message}`;
    const smsStatus = smsResult.status === 'fulfilled' ? 'ok' : `failed: ${smsResult.reason?.message}`;
    console.log(`[stripe/webhook] Trial-will-end notifications: email=${emailStatus}, sms=${smsStatus}`);

    // Record send in billing_notifications for idempotency (upsert with ignoreDuplicates for atomic dedup)
    await supabase.from('billing_notifications').upsert(
      {
        tenant_id: tenantId,
        notification_type: 'trial_will_end',
        metadata: { trial_end: subscription.trial_end },
      },
      { onConflict: 'tenant_id,notification_type', ignoreDuplicates: true }
    );

    console.log('[stripe/webhook] Trial-will-end notification sent for tenant:', tenantId);
  } catch (err) {
    console.error('[stripe/webhook] handleTrialWillEnd error:', err);
    // Do NOT rethrow — notification failure must not cause Stripe retry (Pitfall 3)
  }
}

/**
 * Handle invoice.payment_failed — send SMS + email with Stripe Customer Portal URL.
 * Phase 24: BILLNOTIF-01
 * Uses Promise.allSettled — notification failures never crash the handler (Pitfall 3).
 */
async function handleInvoicePaymentFailed(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      console.warn('[stripe/webhook] handleInvoicePaymentFailed: no subscription on invoice');
      return;
    }

    // Lookup subscription to get tenant_id
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tenant_id')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('is_current', true)
      .maybeSingle();

    if (!sub?.tenant_id) {
      console.warn('[stripe/webhook] handleInvoicePaymentFailed: no subscription found for:', subscriptionId);
      return;
    }

    // Lookup tenant for owner contact info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, owner_email, owner_phone')
      .eq('id', sub.tenant_id)
      .single();

    if (!tenant) {
      console.warn('[stripe/webhook] handleInvoicePaymentFailed: tenant not found:', sub.tenant_id);
      return;
    }

    // Generate Stripe Customer Portal URL for direct payment method update (D-05)
    const session = await stripe.billingPortal.sessions.create({
      customer: invoice.customer,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    // Send SMS + email in parallel via Promise.allSettled — failures logged, never thrown (Pitfall 3)
    const [smsResult, emailResult] = await Promise.allSettled([
      getTwilioClient().messages.create({
        body: `Voco: Your payment failed. Update your card to keep your calls answered: ${session.url}`,
        to: tenant.owner_phone,
        from: process.env.TWILIO_FROM_NUMBER,
      }),
      getResendClient().emails.send({
        from: 'Voco <notifications@voco.live>',
        to: tenant.owner_email,
        subject: 'Action needed: Voco payment failed',
        react: PaymentFailedEmail({
          businessName: tenant.business_name,
          ownerName: tenant.business_name,
          portalUrl: session.url,
        }),
      }),
    ]);

    const smsStatus = smsResult.status === 'fulfilled' ? 'ok' : `failed: ${smsResult.reason?.message}`;
    const emailStatus = emailResult.status === 'fulfilled' ? 'ok' : `failed: ${emailResult.reason?.message}`;
    console.log(`[stripe/webhook] Payment failed notifications: sms=${smsStatus}, email=${emailStatus}`);
    console.log('[stripe/webhook] Payment failed notification sent for tenant:', sub.tenant_id);
  } catch (err) {
    console.error('[stripe/webhook] handleInvoicePaymentFailed error:', err);
    // Do NOT rethrow — notification failure must not cause Stripe retry (Pitfall 3)
  }
}
