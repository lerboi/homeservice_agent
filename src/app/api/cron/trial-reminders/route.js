/**
 * Vercel Cron — Trial Reminder Emails (BILLNOTIF-02)
 *
 * Schedule: daily at 09:00 UTC (0 9 * * *)
 * Sends day 7 and day 12 trial reminder emails via Resend.
 * Idempotency via billing_notifications table (D-07).
 */

import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';
import { TrialReminderEmail } from '@/emails/TrialReminderEmail';

let resendClient = null;
function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function GET(request) {
  // Auth check (same pattern as send-recovery-sms)
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Query all trialing subscriptions
  const { data: trialSubs, error } = await supabase
    .from('subscriptions')
    .select('tenant_id, trial_ends_at, current_period_start, calls_used, calls_limit')
    .eq('status', 'trialing')
    .eq('is_current', true)
    .not('trial_ends_at', 'is', null);

  if (error) {
    console.error('[trial-reminders] Failed to query subscriptions:', error);
    return Response.json({ error: 'Query failed' }, { status: 500 });
  }

  let sent7 = 0, sent12 = 0, skipped = 0;

  if (!trialSubs?.length) {
    return Response.json({ sent_day_7: 0, sent_day_12: 0, skipped: 0 });
  }

  // Batch-fetch tenants and existing notifications to avoid N+1 queries
  const tenantIds = [...new Set(trialSubs.map(s => s.tenant_id))];

  const [tenantsResult, notificationsResult] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, business_name, owner_email')
      .in('id', tenantIds),
    supabase
      .from('billing_notifications')
      .select('tenant_id, notification_type')
      .in('tenant_id', tenantIds)
      .in('notification_type', ['trial_reminder_day_7', 'trial_reminder_day_12']),
  ]);

  const tenantMap = new Map((tenantsResult.data || []).map(t => [t.id, t]));
  const sentNotifications = new Set(
    (notificationsResult.data || []).map(n => `${n.tenant_id}:${n.notification_type}`)
  );

  for (const sub of trialSubs) {
    const trialStart = new Date(sub.current_period_start);
    const daysSinceStart = Math.floor((Date.now() - trialStart.getTime()) / 86_400_000);

    // Determine which reminders to send (day 12 first to preserve correct daysRemaining)
    const reminders = [];
    if (daysSinceStart >= 12) {
      reminders.push({ type: 'trial_reminder_day_12', daysUsed: 12, daysRemaining: 2 });
    }
    if (daysSinceStart >= 7) {
      reminders.push({ type: 'trial_reminder_day_7', daysUsed: 7, daysRemaining: 7 });
    }

    for (const reminder of reminders) {
      // Idempotency check — use batch-fetched set
      if (sentNotifications.has(`${sub.tenant_id}:${reminder.type}`)) {
        skipped++;
        continue;
      }

      // Tenant lookup — use batch-fetched map
      const tenant = tenantMap.get(sub.tenant_id);

      if (!tenant?.owner_email) {
        console.warn(`[trial-reminders] No tenant/email for ${sub.tenant_id}`);
        continue;
      }

      const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/more/billing`;

      // Determine email subject per UI-SPEC copywriting contract
      const subject = reminder.type === 'trial_reminder_day_7'
        ? "You're 7 days into your Voco trial"
        : '2 days left in your Voco trial';

      try {
        await getResendClient().emails.send({
          from: 'Voco <notifications@voco.live>',
          to: tenant.owner_email,
          subject,
          react: TrialReminderEmail({
            businessName: tenant.business_name,
            daysUsed: reminder.daysUsed,
            daysRemaining: reminder.daysRemaining,
            callsUsed: sub.calls_used || 0,
            callsLimit: sub.calls_limit || 0,
            upgradeUrl,
          }),
        });

        // Record send for idempotency (upsert with ignoreDuplicates for atomic dedup at DB level)
        await supabase.from('billing_notifications').upsert(
          {
            tenant_id: sub.tenant_id,
            notification_type: reminder.type,
            metadata: { subject, days_used: reminder.daysUsed },
          },
          { onConflict: 'tenant_id,notification_type', ignoreDuplicates: true }
        );

        if (reminder.type === 'trial_reminder_day_7') sent7++;
        else sent12++;

        console.log(`[trial-reminders] Sent ${reminder.type} to ${sub.tenant_id}`);
      } catch (err) {
        // Log but don't throw — continue to next tenant
        console.error(`[trial-reminders] Failed to send ${reminder.type} to ${sub.tenant_id}:`, err?.message);
      }
    }
  }

  return Response.json({ sent_day_7: sent7, sent_day_12: sent12, skipped });
}
