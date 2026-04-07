import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

/**
 * Verify checkout completion.
 *
 * 1. Check local DB for an active/trialing subscription (fast path — webhook already processed).
 * 2. If no local row and a session_id is provided, retrieve the Checkout Session from Stripe.
 *    If Stripe says the session is complete and paid, run inline fulfillment as a fallback
 *    for delayed/missing webhooks. The webhook will arrive later and harmlessly hit the
 *    idempotency guard (stripe_webhook_events UNIQUE constraint + out-of-order timestamp check).
 */

import { PLAN_MAP, OVERAGE_PRICE_IDS, OVERAGE_MAP, PLAN_NAMES } from '@/lib/stripe-plans';

export async function GET(request) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant } = await adminSupabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) {
    return Response.json({ verified: false });
  }

  // ── Fast path: check local DB first ──
  const { data: subscription } = await adminSupabase
    .from('subscriptions')
    .select('plan_id, trial_ends_at, status')
    .eq('tenant_id', tenant.id)
    .eq('is_current', true)
    .maybeSingle();

  if (subscription && ['trialing', 'active'].includes(subscription.status)) {
    return Response.json({
      verified: true,
      planName: PLAN_NAMES[subscription.plan_id] || subscription.plan_id,
      trialEndDate: subscription.trial_ends_at,
    });
  }

  // ── Fallback: retrieve session from Stripe directly ──
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return Response.json({ verified: false });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify this session belongs to this tenant
    if (session.metadata?.tenant_id !== tenant.id) {
      console.warn('[verify-checkout] Session tenant mismatch:', {
        sessionTenant: session.metadata?.tenant_id,
        userTenant: tenant.id,
      });
      return Response.json({ verified: false });
    }

    // Check if checkout is complete and payment was collected (or trial started)
    if (session.status !== 'complete' || session.payment_status === 'unpaid') {
      return Response.json({ verified: false });
    }

    // Session is paid — run inline fulfillment as webhook fallback
    if (session.subscription) {
      await fulfillSubscription(session, tenant.id);

      // Re-check local DB after fulfillment
      const { data: newSub } = await adminSupabase
        .from('subscriptions')
        .select('plan_id, trial_ends_at, status')
        .eq('tenant_id', tenant.id)
        .eq('is_current', true)
        .maybeSingle();

      if (newSub && ['trialing', 'active'].includes(newSub.status)) {
        return Response.json({
          verified: true,
          planName: PLAN_NAMES[newSub.plan_id] || newSub.plan_id,
          trialEndDate: newSub.trial_ends_at,
        });
      }
    }
  } catch (err) {
    console.error('[verify-checkout] Stripe fallback error:', err.message);
    // Don't throw — return verified: false so the client retries
  }

  return Response.json({ verified: false });
}

/**
 * Inline fulfillment — mirrors the webhook's handleCheckoutCompleted logic.
 * Safe to run multiple times: handleSubscriptionSync uses out-of-order protection
 * and the webhook's idempotency table prevents double processing.
 */
async function fulfillSubscription(session, tenantId) {
  console.log('[verify-checkout] Running inline fulfillment for session:', session.id);

  // Mark onboarding complete
  await adminSupabase
    .from('tenants')
    .update({ onboarding_complete: true })
    .eq('id', tenantId);

  // Retrieve the subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription);

  // Add metered overage price if not already present
  const flatRateItem = subscription.items?.data?.find((item) => PLAN_MAP[item.price?.id]);
  const priceId = flatRateItem?.price?.id;
  const planEntry = Object.entries(PLAN_MAP).find(([key]) => key === priceId);
  const planKey = planEntry ? planEntry[1].plan_id : null;
  const overagePriceId = planKey ? OVERAGE_MAP[planKey] : null;
  const hasOverage = subscription.items?.data?.some((item) => OVERAGE_PRICE_IDS.has(item.price?.id));

  if (overagePriceId && !hasOverage) {
    try {
      await stripe.subscriptionItems.create(
        { subscription: subscription.id, price: overagePriceId },
        { idempotencyKey: `add_overage_${subscription.id}` },
      );
      console.log(`[verify-checkout] Added overage item (${overagePriceId}) to subscription ${subscription.id}`);
    } catch (overageErr) {
      console.error(`[verify-checkout] Failed to add overage item:`, overageErr.message);
    }
  }

  // Re-retrieve with overage item included, then sync to local DB
  const updatedSubscription = await stripe.subscriptions.retrieve(session.subscription);
  await syncSubscription(updatedSubscription, tenantId);
}

/**
 * Sync subscription to local DB — mirrors webhook's handleSubscriptionEvent.
 * Uses out-of-order protection so it's safe even if the webhook fires concurrently.
 */
async function syncSubscription(subscription, tenantId) {
  const rawTimestamp = subscription.updated || subscription.created;
  const stripeUpdatedAt = new Date(rawTimestamp * 1000).toISOString();

  // Out-of-order protection
  const { data: currentRow } = await adminSupabase
    .from('subscriptions')
    .select('stripe_updated_at, calls_used')
    .eq('stripe_subscription_id', subscription.id)
    .eq('is_current', true)
    .maybeSingle();

  if (currentRow?.stripe_updated_at) {
    if (currentRow.stripe_updated_at >= stripeUpdatedAt) {
      // Already have this or newer data — skip
      console.log('[verify-checkout] Subscription already synced, skipping');
      return;
    }
  }

  // Resolve plan info
  const subscriptionItems = subscription.items?.data || [];
  const flatRateItem = subscriptionItems.find((item) => PLAN_MAP[item.price?.id]);
  const overageItem = subscriptionItems.find((item) => OVERAGE_PRICE_IDS.has(item.price?.id));
  const priceId = flatRateItem?.price?.id;
  const planInfo = PLAN_MAP[priceId] || { plan_id: 'starter', calls_limit: 40 };
  const overageStripeItemId = overageItem?.id || null;

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
  const callsUsed = currentRow?.calls_used ?? 0;

  // Insert new row, then mark old rows inactive (history table pattern)
  const { data: newRow, error: insertError } = await adminSupabase
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
    console.error('[verify-checkout] Failed to insert subscription row:', insertError);
    return;
  }

  // Mark prior rows inactive
  await adminSupabase
    .from('subscriptions')
    .update({ is_current: false })
    .eq('stripe_subscription_id', subscription.id)
    .eq('is_current', true)
    .neq('id', newRow.id);

  console.log(`[verify-checkout] Synced subscription ${subscription.id} status=${localStatus} plan=${planInfo.plan_id}`);
}
