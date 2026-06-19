#!/usr/bin/env node
/**
 * Phase 40: Cutover existing tenant Twilio numbers to webhook routing.
 *
 * Reads all tenants with phone_number IS NOT NULL from Supabase,
 * looks up each number's SID from Twilio, sets voice_url,
 * voice_fallback_url, and sms_url to the Railway webhook, AND removes the
 * number from the Elastic SIP trunk.
 *
 * Why disassociate the trunk: a number associated with a SIP trunk IGNORES its
 * voice_url (the trunk's origination URI wins). Leaving the trunk on (the
 * original "D-21 rollback safety net") meant webhook routing never took effect.
 * Rollback is now: re-add the number to the trunk (Twilio console or the
 * provisioning fail-safe), which immediately resumes AI-direct routing.
 * Idempotent: running twice sets the same URLs; the trunk removal 404s once
 * the number is already off the trunk.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, RAILWAY_WEBHOOK_URL,
 *   TWILIO_SIP_TRUNK_SID
 *
 * Usage: node scripts/cutover-existing-numbers.js [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

const base = process.env.RAILWAY_WEBHOOK_URL;
if (!base) {
  console.error('RAILWAY_WEBHOOK_URL is required');
  process.exit(1);
}

// Required to disassociate numbers from the trunk — without it the cutover is
// unsound (trunk_sid wins over voice_url, so webhook routing never activates).
const trunkSid = process.env.TWILIO_SIP_TRUNK_SID;
if (!trunkSid) {
  console.error('TWILIO_SIP_TRUNK_SID is required (numbers must be removed from the trunk for voice_url routing to take effect)');
  process.exit(1);
}

const voiceUrl = `${base}/twilio/incoming-call`;
const voiceFallbackUrl = `${base}/twilio/dial-fallback`;
const smsUrl = `${base}/twilio/incoming-sms`;

async function main() {
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Webhook base: ${base}`);

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, phone_number')
    .not('phone_number', 'is', null);

  if (error) {
    console.error('Supabase query failed:', error);
    process.exit(1);
  }

  console.log(`Found ${tenants.length} tenants with phone numbers`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const tenant of tenants) {
    try {
      const numbers = await client.incomingPhoneNumbers.list({
        phoneNumber: tenant.phone_number,
        limit: 1,
      });

      if (!numbers.length) {
        console.warn(`SKIP: No Twilio number found for ${tenant.phone_number} (tenant ${tenant.id})`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`DRY RUN: Would set webhook URLs on + remove from trunk ${tenant.phone_number} (SID: ${numbers[0].sid})`);
        updated++;
        continue;
      }

      // Set the webhook URLs first so the number stays routable the instant it
      // leaves the trunk (no unrouted window).
      await client.incomingPhoneNumbers(numbers[0].sid).update({
        voiceUrl,
        voiceMethod: 'POST',
        voiceFallbackUrl,
        voiceFallbackMethod: 'POST',
        smsUrl,
        smsMethod: 'POST',
      });

      // Disassociate from the trunk so voice_url actually takes precedence.
      // Idempotent: a number already off the trunk returns 404, which we ignore.
      try {
        await client.trunking.v1.trunks(trunkSid).phoneNumbers(numbers[0].sid).remove();
      } catch (trunkErr) {
        if (trunkErr?.status !== 404) throw trunkErr;
      }

      console.log(`UPDATED: ${tenant.phone_number} (SID: ${numbers[0].sid}) — webhook URLs set, removed from trunk`);
      updated++;
    } catch (err) {
      console.error(`FAILED: ${tenant.phone_number} (tenant ${tenant.id}):`, err.message);
      failed++;
    }
  }

  console.log(`\nSummary: ${updated} updated, ${skipped} skipped, ${failed} failed out of ${tenants.length} total`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
