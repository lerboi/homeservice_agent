#!/usr/bin/env node
/**
 * Phase 40: Cutover existing tenant Twilio numbers to webhook routing.
 *
 * Reads all tenants with phone_number IS NOT NULL from Supabase,
 * looks up each number's SID from Twilio, and sets voice_url,
 * voice_fallback_url, and sms_url to the Railway webhook.
 *
 * SIP trunk associations are NOT removed (D-21 rollback safety net).
 * Idempotent: running twice sets the same URLs.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, RAILWAY_WEBHOOK_URL
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
        console.log(`DRY RUN: Would update ${tenant.phone_number} (SID: ${numbers[0].sid})`);
        updated++;
        continue;
      }

      await client.incomingPhoneNumbers(numbers[0].sid).update({
        voiceUrl,
        voiceFallbackUrl,
        smsUrl,
      });

      console.log(`UPDATED: ${tenant.phone_number} (SID: ${numbers[0].sid})`);
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
