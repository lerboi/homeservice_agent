// Phase 56 UAT Test 5 — force a Jobber refresh-failure notification.
//
// Usage:
//   node --env-file=.env.local scripts/test-jobber-refresh-email.mjs [owner_email] [tenant_id]
//
// Inlines the notifyJobberRefreshFailure logic (persist error_state + send
// Resend email) to avoid importing Next.js-only modules (next/cache). Skips
// the revalidateTag call — the IntegrationReconnectBanner polls every 30s
// so the banner still appears on its own.
//
// After running, verify:
//   (a) owner's inbox for subject "Your Jobber connection needs attention"
//   (b) /dashboard/calendar shows the amber Reconnect banner within ~30s
//   (c) /dashboard/more/integrations — Jobber card in Error state
//
// To clear: reconnect Jobber in the UI, or run:
//   update accounting_credentials set error_state=null where provider='jobber';

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import React from 'react';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const admin = createClient(url, key);

// Resolve inputs
const argEmail = process.argv[2];
const argTenant = process.argv[3];
let tenantId = argTenant;
if (!tenantId) {
  const { data } = await admin
    .from('accounting_credentials')
    .select('tenant_id')
    .eq('provider', 'jobber')
    .limit(1)
    .maybeSingle();
  tenantId = data?.tenant_id;
}
if (!tenantId) {
  console.error('No tenant_id found.');
  process.exit(1);
}
const { data: tenant } = await admin
  .from('tenants')
  .select('email, personal_email, business_email, business_name')
  .eq('id', tenantId)
  .maybeSingle();
const ownerEmail =
  argEmail ??
  tenant?.business_email ??
  tenant?.email ??
  tenant?.personal_email ??
  null;

console.log('Tenant:', tenant?.business_name || tenantId);
console.log('Owner email:', ownerEmail || '(none)');

// 1. Persist error_state
const { error: updErr } = await admin
  .from('accounting_credentials')
  .update({ error_state: 'token_refresh_failed' })
  .eq('tenant_id', tenantId)
  .eq('provider', 'jobber');
if (updErr) {
  console.error('Failed to set error_state:', updErr.message);
  process.exit(1);
}
console.log('error_state set to token_refresh_failed');

// 2. Send Resend email (requires owner email + RESEND_API_KEY)
if (!ownerEmail) {
  console.log('Skipping email — no owner email available.');
  process.exit(0);
}
if (!resendKey) {
  console.log('Skipping email — RESEND_API_KEY not set.');
  process.exit(0);
}

// Send minimal HTML email — JSX components can't be imported in plain Node
// without a bundler. Matches the subject + CTA spec from JobberReconnectEmail
// (UI-SPEC §Copywriting). Tests the Resend plumbing + notifier flow end-to-end.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const reconnectUrl = `${appUrl}/dashboard/more/integrations`;
const html = `
<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 20px; margin: 0 0 12px;">Your Jobber connection needs attention</h1>
  <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px;">
    We couldn't refresh your Jobber access. Your AI receptionist can't pull customer context from Jobber until you reconnect.
  </p>
  <p style="margin: 24px 0;">
    <a href="${reconnectUrl}" style="display:inline-block; background:#1B9F4F; color:#fff; text-decoration:none; padding:10px 18px; border-radius:6px; font-weight:600;">Reconnect Jobber</a>
  </p>
  <p style="font-size: 13px; color: #666; margin: 16px 0 0;">
    If the button doesn't work, paste this into your browser: ${reconnectUrl}
  </p>
</body></html>
`.trim();

const resend = new Resend(resendKey);
try {
  const res = await resend.emails.send({
    from: 'Voco <noreply@voco.live>',
    to: ownerEmail,
    subject: 'Your Jobber connection needs attention',
    html,
  });
  console.log('Resend response:', res);
} catch (e) {
  console.error('Resend send failed:', e?.message || e);
  process.exit(1);
}

console.log('\nCheck:');
console.log('  1. Inbox for "Your Jobber connection needs attention"');
console.log('  2. /dashboard/calendar — amber "Reconnect Jobber" banner within 30s');
console.log('  3. /dashboard/more/integrations — Jobber card in Error state');
