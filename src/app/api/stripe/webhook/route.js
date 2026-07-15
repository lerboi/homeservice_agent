import * as Sentry from '@sentry/nextjs';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { PaymentFailedEmail } from '@/emails/PaymentFailedEmail';
import { TrialReminderEmail } from '@/emails/TrialReminderEmail';
import { activateTenant, getTwilioClient, getResendClient } from '@/lib/tenant-activation';
import { PLAN_MAP, OVERAGE_PRICE_IDS, OVERAGE_MAP } from '@/lib/stripe-plans';

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

  // 2. Idempotency check (D-09) — atomic "processing claim" pattern.
  // The pre-handler INSERT wins the concurrency race (UNIQUE on event_id) and
  // doubles as the claim (processing_started_at = now, migration 068). On a
  // duplicate (23505) we must NOT blindly re-run: the first delivery may still
  // be mid-flight (concurrent re-run caused double Twilio number purchases).
  // Instead, atomically claim the row with a conditional UPDATE that only
  // matches when the event is unprocessed AND has no live claim (NULL or older
  // than 10 minutes — stale claims from crashed workers are stolen). If no row
  // is claimed, another worker owns the event or it's already done → ack.
  const { error: idempotencyError } = await supabase
    .from('stripe_webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      processing_started_at: new Date().toISOString(),
    });

  if (idempotencyError?.code === '23505') {
    // Duplicate event — try to claim it (only succeeds for a dead/failed prior attempt).
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: claimed, error: claimError } = await supabase
      .from('stripe_webhook_events')
      .update({ processing_started_at: new Date().toISOString() })
      .eq('event_id', event.id)
      .eq('processed', false)
      .or(`processing_started_at.is.null,processing_started_at.lt.${tenMinAgo}`)
      .select('id');

    if (claimError) {
      console.error('[stripe/webhook] Idempotency claim error:', claimError);
      // Couldn't determine state — return 500 so Stripe retries.
      return Response.json({ error: 'Idempotency check failed' }, { status: 500 });
    }

    if (!claimed || claimed.length === 0) {
      // Distinguish "already done" from "another claim is live". Acking 200
      // here unconditionally lost events permanently: if the first delivery
      // died without releasing its claim (function timeout, OOM), Stripe's
      // retry landed inside the 10-minute claim window, got the 200, and
      // Stripe stopped retrying forever while the row sat processed=false.
      const { data: existing, error: stateError } = await supabase
        .from('stripe_webhook_events')
        .select('processed')
        .eq('event_id', event.id)
        .maybeSingle();

      if (stateError || !existing) {
        console.error('[stripe/webhook] Idempotency state lookup failed:', stateError);
        return Response.json({ error: 'Idempotency check failed' }, { status: 500 });
      }

      if (existing.processed) {
        // Fully processed — safe to ack.
        return Response.json({ received: true });
      }

      // processed=false with a live claim: either another worker is mid-flight
      // (its eventual success makes this retry ack on processed=true) or the
      // claim holder is dead (the claim goes stale after 10 minutes and the
      // next retry steals it). Either way: non-2xx so Stripe keeps retrying.
      console.warn(`[stripe/webhook] Event ${event.id} has a live claim and is unprocessed — asking Stripe to retry`);
      return Response.json({ error: 'Event is being processed' }, { status: 500 });
    }
    // Claimed a stale/failed attempt → fall through and re-run the (idempotent) handler.
  } else if (idempotencyError) {
    console.error('[stripe/webhook] Idempotency insert error:', idempotencyError);
    // DB error (not duplicate) — return 500 so Stripe retries after DB recovers
    return Response.json({ error: 'Idempotency check failed' }, { status: 500 });
  }

  // 3. Event routing (D-08 — synchronous, no after())
  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object, event.created);
    } else if (event.type === 'customer.subscription.created') {
      await handleSubscriptionEvent(event.data.object, event.created);
    } else if (event.type === 'customer.subscription.updated') {
      await handleSubscriptionEvent(event.data.object, event.created);
    } else if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionEvent(event.data.object, event.created);
    } else if (event.type === 'customer.subscription.paused') {
      await handleSubscriptionEvent(event.data.object, event.created);
    } else if (event.type === 'customer.subscription.resumed') {
      await handleSubscriptionEvent(event.data.object, event.created);
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
    // Release the claim so Stripe's retry can re-claim immediately instead of
    // waiting out the 10-minute staleness window (best effort — if this write
    // fails, the staleness window is the backstop).
    const { error: releaseError } = await supabase
      .from('stripe_webhook_events')
      .update({ processing_started_at: null })
      .eq('event_id', event.id);
    if (releaseError) {
      console.error('[stripe/webhook] Failed to release processing claim:', releaseError);
    }
    // Return 500 so Stripe retries. The event_id row stays processed=false so
    // the retry re-claims and re-runs the handler instead of short-circuiting.
    return Response.json({ error: 'Handler failed' }, { status: 500 });
  }

  // 3b. Handler succeeded — mark the event processed so future retries ack
  // immediately instead of re-running side effects.
  const { error: processedError } = await supabase
    .from('stripe_webhook_events')
    .update({ processed: true })
    .eq('event_id', event.id);

  if (processedError) {
    // Side effects DID complete; only the flag write failed. Returning 500 makes
    // Stripe retry, which safely replays the idempotent handler and re-attempts
    // the flag write — preferable to acking with the row stuck at processed=false.
    // Release the claim (best effort) so the retry can re-claim immediately.
    console.error('[stripe/webhook] Failed to mark event processed:', processedError);
    await supabase
      .from('stripe_webhook_events')
      .update({ processing_started_at: null })
      .eq('event_id', event.id);
    return Response.json({ error: 'Idempotency finalize failed' }, { status: 500 });
  }

  // 4. Return success
  return Response.json({ received: true });
}

/**
 * Handle checkout.session.completed — marks onboarding complete and creates
 * the initial subscription row by delegating to handleSubscriptionEvent.
 */
export async function handleCheckoutCompleted(session, eventCreated) {
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
    // Throw so the route returns 500 and Stripe retries — swallowing this left
    // tenants who PAID with onboarding_complete=false (dashboard redirect loop)
    // because the event was then marked processed and never retried.
    console.error('[stripe/webhook] Failed to set onboarding_complete:', tenantError);
    throw tenantError;
  }

  // Seed activation defaults (working hours + timezone) and provision the phone
  // number. Shared with the verify-checkout fallback and the sweeper/backfill via
  // activateTenant() so billing fulfillment and activation can never diverge.
  // Throws only on a phone-number write failure → this handler propagates it, the
  // POST returns 500, and Stripe retries (provisioning idempotency reuses the same
  // number). Seeding and email failures are non-fatal inside activateTenant.
  await activateTenant(tenantId, { eventCreatedForTrial: eventCreated });

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
        // Non-fatal for the checkout flow (subscription works without overage),
        // but NEVER silent: a missing overage item means over-quota calls are
        // recorded to the meter and never rated — unbilled revenue. Alert so it
        // gets fixed (annual subs require flexible billing mode; see the
        // checkout routes).
        console.error(`[stripe/webhook] Failed to add overage item to subscription ${subscription.id}:`, overageErr.message);
        Sentry.captureMessage(
          `Stripe overage attach FAILED for subscription ${subscription.id}: ${overageErr.message} — overage on this subscription is unbillable until the item is added`,
          'error',
        );
      }
    }

    // Re-retrieve subscription with the overage item included
    const updatedSubscription = await stripe.subscriptions.retrieve(session.subscription);
    await handleSubscriptionEvent(updatedSubscription, eventCreated);
  }
}

/**
 * Core subscription sync — handles created/updated/deleted/paused/resumed events.
 * Implements out-of-order protection (D-10) and history table pattern (D-13).
 */
export async function handleSubscriptionEvent(subscription, eventCreated) {
  let tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) {
    // Dashboard-created (or otherwise metadata-less) subscriptions: resolve the
    // tenant from the Stripe customer id via a prior subscription row instead of
    // silently dropping the event (2026-06-12 audit M4).
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    if (customerId) {
      const { data: byCustomer } = await supabase
        .from('subscriptions')
        .select('tenant_id')
        .eq('stripe_customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      tenantId = byCustomer?.tenant_id || null;
    }
  }
  if (!tenantId) {
    console.warn('[stripe/webhook] Subscription has no resolvable tenant (no metadata, no customer match):', subscription.id);
    return;
  }

  // Out-of-order protection (D-10)
  // The Subscription object has no "updated" timestamp (subscription.updated does
  // not exist), so we use the EVENT ENVELOPE's created time (epoch seconds):
  // Stripe stamps every event when it's generated, which gives a real ordering
  // across created/updated/deleted deliveries — including across cancel→re-subscribe
  // where the subscription id changes. Compared via Date.parse (the old string
  // comparison broke on PostgREST's `+00:00` vs toISOString's `Z` formats).
  const eventCreatedMs = eventCreated * 1000;
  const stripeUpdatedAt = new Date(eventCreatedMs).toISOString();

  // Look up the tenant's current row (any subscription id) so late events from a
  // replaced subscription are compared against the row that superseded them.
  const { data: currentRow } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, stripe_updated_at, calls_used')
    .eq('tenant_id', tenantId)
    .eq('is_current', true)
    .maybeSingle();

  if (
    currentRow?.stripe_updated_at &&
    Date.parse(currentRow.stripe_updated_at) > eventCreatedMs
  ) {
    // Incoming event is older than what we already stored — skip
    console.log('[stripe/webhook] Skipping stale event for subscription:', subscription.id);
    return;
  }

  // Price-to-plan mapping (D-12)
  // With overage metered pricing, subscription.items.data has 2 entries (flat-rate + metered).
  // Find the flat-rate item by matching against PLAN_MAP keys (not by index).
  const subscriptionItems = subscription.items?.data || [];
  const flatRateItem = subscriptionItems.find((item) => PLAN_MAP[item.price?.id]);
  const overageItem = subscriptionItems.find((item) => OVERAGE_PRICE_IDS.has(item.price?.id));

  const priceId = flatRateItem?.price?.id;
  // `flatRateItem` only matches when the price is in PLAN_MAP, so no match means the
  // subscription carries no price we recognize (env drift, a new plan not added to
  // PLAN_MAP, or a malformed subscription). We still write the row using a starter/40
  // fallback so the tenant isn't left without a subscription, but a mis-mapped plan
  // means wrong quota AND wrong overage rating — alert loudly instead of silently.
  if (!flatRateItem) {
    const seenPrices = subscriptionItems.map((i) => i.price?.id).filter(Boolean).join(', ') || 'none';
    console.error(`[stripe/webhook] No PLAN_MAP price on subscription ${subscription.id} (items: ${seenPrices}) — defaulting to starter/40`);
    Sentry.captureMessage(
      `Stripe subscription ${subscription.id} has no PLAN_MAP price (items: ${seenPrices}) — defaulted to starter/40; quota and overage will be wrong until PLAN_MAP or the price is corrected`,
      'error',
    );
  }
  const planInfo = PLAN_MAP[priceId] || { plan_id: 'starter', calls_limit: 40 };
  const overageStripeItemId = overageItem?.id || null;

  // Basil (2025-03-31.basil): current_period_start/_end moved from the Subscription
  // to the subscription ITEM. Read from the flat-rate item, falling back to the
  // subscription for pre-Basil correctness.
  const periodStart = flatRateItem?.current_period_start ?? subscription.current_period_start;
  const periodEnd = flatRateItem?.current_period_end ?? subscription.current_period_end;

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

  // Carry forward calls_used from the prior row of the SAME subscription (plan
  // changes keep the id). A replacement subscription (cancel→re-subscribe gets a
  // new id) starts a fresh billing cycle, so its usage starts at 0.
  const callsUsed =
    currentRow?.stripe_subscription_id === subscription.id
      ? currentRow.calls_used ?? 0
      : 0;

  // History table pattern (D-13), updated for migration 068:
  // Unmark ALL of the tenant's current rows FIRST, then insert the new current
  // row. The partial unique index idx_subscriptions_one_current (one is_current
  // row per tenant) rejects insert-first, and unmarking by tenant_id (not
  // stripe_subscription_id) is what prevents cancel→re-subscribe from leaving
  // two current rows. The brief zero-current window is safe: the subscription
  // gate fails open and readers use order+limit to pick the latest row.
  const { error: unmarkError } = await supabase
    .from('subscriptions')
    .update({ is_current: false })
    .eq('tenant_id', tenantId)
    .eq('is_current', true);

  if (unmarkError) {
    console.error('[stripe/webhook] Failed to unmark prior subscription rows:', unmarkError);
    throw unmarkError;
  }

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
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      stripe_updated_at: stripeUpdatedAt,
      overage_stripe_item_id: overageStripeItemId,
      is_current: true,
    });

  if (insertError) {
    // Includes 23505 from idx_subscriptions_one_current if a concurrent writer
    // inserted a current row between our unmark and insert — throw so Stripe
    // retries and the sync converges.
    console.error('[stripe/webhook] Failed to insert subscription row:', insertError);
    throw insertError;
  }

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
export async function handleInvoicePaid(invoice) {
  if (invoice.billing_reason !== 'subscription_cycle') {
    return;
  }

  // Basil (2025-03-31.basil): invoice.subscription moved to
  // invoice.parent.subscription_details.subscription.
  const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;

  const { data: resetRows, error } = await supabase
    .from('subscriptions')
    .update({ calls_used: 0 })
    .eq('stripe_subscription_id', subscriptionId)
    .eq('is_current', true)
    .select('id');

  if (error) {
    console.error('[stripe/webhook] Failed to reset calls_used:', error);
    throw error;
  }

  // 0 rows matched: we're likely racing a concurrent subscription event's
  // unmark→insert window (renewals fire invoice.paid and subscription.updated
  // near-simultaneously), so there is momentarily no is_current row. A 0-row
  // UPDATE is not a PostgREST error — without this check the event was marked
  // processed and the reset silently lost, carrying a full prior cycle's usage
  // into the new cycle (spurious overage). Throw → 500 → Stripe retries after
  // the subscription event lands.
  if (!resetRows || resetRows.length === 0) {
    throw new Error(
      `invoice.paid usage reset matched 0 rows for subscription ${subscriptionId} — retrying via Stripe`,
    );
  }

  console.log(`[stripe/webhook] Reset calls_used for subscription ${subscriptionId}`);
}

/**
 * Handle customer.subscription.trial_will_end — send email + SMS notification.
 * Phase 24: BILLNOTIF-03
 * Idempotency via billing_notifications table (D-07).
 * Notification failures are logged but never thrown (Pitfall 3 in RESEARCH.md).
 */
export async function handleTrialWillEnd(subscription) {
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
export async function handleInvoicePaymentFailed(invoice) {
  try {
    // Basil (2025-03-31.basil): invoice.subscription moved to
    // invoice.parent.subscription_details.subscription.
    const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
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
