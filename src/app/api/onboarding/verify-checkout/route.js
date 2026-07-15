import * as Sentry from '@sentry/nextjs';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase as adminSupabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { activateTenant } from '@/lib/tenant-activation';

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
      // Never silent: a missing overage item means over-quota calls are
      // metered but never rated — unbilled revenue (annual subs require
      // flexible billing mode; see the checkout routes).
      console.error(`[verify-checkout] Failed to add overage item:`, overageErr.message);
      Sentry.captureMessage(
        `Stripe overage attach FAILED (verify-checkout) for subscription ${subscription.id}: ${overageErr.message}`,
        'error',
      );
    }
  }

  // Re-retrieve with overage item included, then sync to local DB
  const updatedSubscription = await stripe.subscriptions.retrieve(session.subscription);
  await syncSubscription(updatedSubscription, tenantId);

  // Billing is now guaranteed (onboarding_complete + subscription synced). ONLY
  // after that do we seed working hours + provision the phone number, best-effort:
  // a provisioning/Twilio error must NEVER block the billing rescue this fallback
  // exists for. Uses the SAME activateTenant path as the webhook so the two can't
  // diverge — omitting this is exactly what previously stranded paying tenants
  // with no number and no working hours (invisibly, provisioning_failed=false).
  try {
    await activateTenant(tenantId, { eventCreatedForTrial: session.created });
  } catch (activationErr) {
    console.error('[verify-checkout] Activation (seed/provision) failed — billing already fulfilled:', activationErr?.message);
    Sentry.captureMessage(
      `verify-checkout activation FAILED for tenant ${tenantId}: ${activationErr?.message} — billing fulfilled but phone/seed may be incomplete; the sweeper will surface it`,
      'error',
    );
  }
}

/**
 * Sync subscription to local DB — mirrors webhook's handleSubscriptionEvent.
 * Uses out-of-order protection so it's safe even if the webhook fires concurrently.
 */
async function syncSubscription(subscription, tenantId) {
  // 2026-06-12 audit M5 — mirror the webhook's corrected ordering:
  // (1) subscription.updated does NOT exist on the Stripe object; this fallback
  //     has no event envelope, so order by subscription.created (epoch seconds).
  //     It is <= any later webhook event time, so a real webhook event still
  //     applies (and isn't wrongly skipped) while this stamps the initial state.
  // (2) compare with Date.parse (numeric), not string >= (which broke on the
  //     PostgREST `+00:00` vs toISOString `Z` formats).
  // (3) look up the tenant's CURRENT row by tenant_id (not stripe_subscription_id)
  //     so the authoritative webhook row is never clobbered by this fallback.
  const versionMs = (subscription.created || Math.floor(Date.now() / 1000)) * 1000;
  const stripeUpdatedAt = new Date(versionMs).toISOString();

  const { data: currentRow } = await adminSupabase
    .from('subscriptions')
    .select('stripe_subscription_id, stripe_updated_at, calls_used')
    .eq('tenant_id', tenantId)
    .eq('is_current', true)
    .maybeSingle();

  if (
    currentRow?.stripe_updated_at &&
    Date.parse(currentRow.stripe_updated_at) >= versionMs
  ) {
    // Webhook (or a newer write) already recorded this — skip
    console.log('[verify-checkout] Subscription already synced, skipping');
    return;
  }

  // Resolve plan info
  const subscriptionItems = subscription.items?.data || [];
  const flatRateItem = subscriptionItems.find((item) => PLAN_MAP[item.price?.id]);
  const overageItem = subscriptionItems.find((item) => OVERAGE_PRICE_IDS.has(item.price?.id));
  const priceId = flatRateItem?.price?.id;
  // No PLAN_MAP match → unrecognized price (env drift / new plan / malformed sub).
  // Fall back to starter/40 so fulfillment still completes, but alert: a mis-mapped
  // plan means wrong quota and wrong overage rating. Mirrors the webhook handler.
  if (!flatRateItem) {
    const seenPrices = subscriptionItems.map((i) => i.price?.id).filter(Boolean).join(', ') || 'none';
    console.error(`[verify-checkout] No PLAN_MAP price on subscription ${subscription.id} (items: ${seenPrices}) — defaulting to starter/40`);
    Sentry.captureMessage(
      `Stripe subscription ${subscription.id} has no PLAN_MAP price (items: ${seenPrices}) — defaulted to starter/40 (verify-checkout fallback); quota and overage will be wrong`,
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
  // Carry usage forward only within the SAME subscription id (plan changes keep
  // the id); a replacement subscription starts a fresh cycle at 0 — matches the webhook.
  const callsUsed =
    currentRow?.stripe_subscription_id === subscription.id
      ? currentRow.calls_used ?? 0
      : 0;

  // History table pattern, updated for migration 068: unmark ALL of the
  // tenant's current rows FIRST (the partial unique index
  // idx_subscriptions_one_current allows only one is_current row per tenant,
  // so insert-first would be rejected), then insert the new current row.
  // Unmarking by tenant_id (not stripe_subscription_id) prevents
  // cancel→re-subscribe from leaving two current rows.
  const { error: unmarkError } = await adminSupabase
    .from('subscriptions')
    .update({ is_current: false })
    .eq('tenant_id', tenantId)
    .eq('is_current', true);

  if (unmarkError) {
    console.error('[verify-checkout] Failed to unmark prior subscription rows:', unmarkError);
    return;
  }

  const { error: insertError } = await adminSupabase
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
    // Includes 23505 from idx_subscriptions_one_current if the webhook inserted
    // concurrently — its row stands, and the client re-polls verified status.
    console.error('[verify-checkout] Failed to insert subscription row:', insertError);
    return;
  }

  console.log(`[verify-checkout] Synced subscription ${subscription.id} status=${localStatus} plan=${planInfo.plan_id}`);
}
