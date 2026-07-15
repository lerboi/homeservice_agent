import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { isValidE164 } from '@/lib/tenant-activation';

/**
 * Sweep for tenants stranded WITHOUT a working phone number (2026-07 P0-3).
 *
 * Provisioning lives in activateTenant(), called by the Stripe webhook and the
 * verify-checkout fallback. If a checkout.session.completed webhook is never
 * delivered (and the fallback's provisioning also fails), a paying/trialing
 * tenant can land onboarding-complete with no number — and, because
 * provisioning_failed is only written on the webhook path, INVISIBLY
 * (provisioning_failed stays false). This nightly sweep makes that state VISIBLE.
 *
 * SAFE BY DESIGN — this cron does NOT purchase numbers. Local subscription status
 * can lag when the Stripe webhook is behind, so autonomously buying (recurring-cost)
 * Twilio numbers off stale status would risk spending on dead/test accounts. Instead
 * it only FLAGS (provisioning_failed=true) so the tenant surfaces in the dashboard /
 * admin, and Sentry-alerts once per newly-discovered strand. Healing is then a
 * deliberate action (admin re-provision or a one-off activateTenant backfill after
 * confirming the account is real).
 *
 * A tenant counts as stranded when ALL hold:
 *  - onboarding_complete = true
 *  - has a CURRENT subscription in trialing/active/past_due (not abandoned/canceled)
 *  - phone_number is not a valid E.164 string ('', junk like '+12', or null)
 *  - created more than RECENT_GRACE_MS ago (so an in-flight signup mid-provision
 *    isn't flagged in its first hour)
 */

const RECENT_GRACE_MS = 60 * 60 * 1000; // 1h: don't flag a signup that may be mid-provision.

export async function GET(request) {
  // Auth guard — same pattern as the other crons.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Actively-subscribed tenants only (an abandoned/canceled signup with no number
  // is expected, not a strand).
  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select('tenant_id')
    .eq('is_current', true)
    .in('status', ['trialing', 'active', 'past_due']);

  if (subErr) {
    console.error('[sweep-unprovisioned] Subscription query error:', subErr.message);
    return Response.json({ error: subErr.message }, { status: 500 });
  }

  const tenantIds = [...new Set((subs || []).map((s) => s.tenant_id).filter(Boolean))];
  if (tenantIds.length === 0) {
    return Response.json({ ok: true, scanned: 0, stranded: 0, flagged: 0 });
  }

  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .select('id, business_name, country, phone_number, provisioning_failed, created_at')
    .in('id', tenantIds)
    .eq('onboarding_complete', true);

  if (tErr) {
    console.error('[sweep-unprovisioned] Tenant query error:', tErr.message);
    return Response.json({ error: tErr.message }, { status: 500 });
  }

  const cutoff = Date.now() - RECENT_GRACE_MS;
  const results = { scanned: 0, stranded: 0, flagged: 0 };

  for (const t of tenants || []) {
    results.scanned += 1;

    if (isValidE164(t.phone_number)) continue; // has a working number
    if (t.created_at && new Date(t.created_at).getTime() > cutoff) continue; // too fresh
    results.stranded += 1;

    // Flag + alert only when newly discovered (avoid nightly Sentry spam for a
    // persistently-stranded tenant that's already visible).
    if (t.provisioning_failed !== true) {
      const { error: flagErr } = await supabase
        .from('tenants')
        .update({ provisioning_failed: true })
        .eq('id', t.id);
      if (flagErr) {
        console.error(`[sweep-unprovisioned] Failed to flag tenant ${t.id}:`, flagErr.message);
        continue;
      }
      results.flagged += 1;
      Sentry.captureMessage(
        `Stranded tenant ${t.id} (${t.business_name || 'unknown'}, ${t.country || '??'}) is onboarding-complete + actively subscribed but has NO valid phone number (${JSON.stringify(t.phone_number)}) — needs provisioning/backfill`,
        'warning',
      );
      console.warn(`[sweep-unprovisioned] Flagged stranded tenant ${t.id} (phone=${JSON.stringify(t.phone_number)})`);
    }
  }

  return Response.json({ ok: true, ...results });
}
