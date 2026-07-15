import * as Sentry from '@sentry/nextjs';
import twilio from 'twilio';
import { Resend } from 'resend';
import { supabase } from '@/lib/supabase';
import { WelcomeEmail } from '@/emails/WelcomeEmail';
import { formatInternational } from '@/lib/phone/normalize';

/**
 * Shared tenant activation — seed working hours/timezone + provision the phone
 * number + send the welcome/failure email.
 *
 * This is the SINGLE fulfillment path used by BOTH the Stripe webhook
 * (handleCheckoutCompleted) and the embedded-checkout fallback (verify-checkout),
 * plus any admin backfill. Previously the provisioning + seeding lived only in
 * the webhook, so when the fallback fulfilled billing (webhook delayed/missing)
 * a paying tenant landed with no number and no working hours, invisibly
 * (provisioning_failed stayed false). Extracting it here guarantees billing
 * fulfillment and activation can never diverge again.
 */

// ─── New-tenant activation defaults (seeded at checkout) ─────────────────────
// Without working_hours the slot calculator returns ZERO slots for every day —
// the AI cannot book anything on the tenant's first (judgment-forming) calls.
// Seed trade-typical hours the owner can refine in Settings. Shape mirrors
// WorkingHoursEditor presets: day-keyed {open, close, enabled, lunchStart, lunchEnd}.
const WH_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
function buildDefaultHours({ open, close, days }) {
  return WH_DAYS.reduce((acc, day) => {
    acc[day] = { open, close, enabled: days.includes(day), lunchStart: null, lunchEnd: null };
    return acc;
  }, {});
}
const WEEKDAYS_PLUS_SAT = WH_DAYS.filter((d) => d !== 'sunday');
const WEEKDAYS_ONLY = WH_DAYS.slice(0, 5);
const DEFAULT_WORKING_HOURS_BY_TRADE = {
  // Emergency-prone trades: longer days incl. Saturday
  plumber: buildDefaultHours({ open: '07:00', close: '18:00', days: WEEKDAYS_PLUS_SAT }),
  hvac: buildDefaultHours({ open: '07:00', close: '18:00', days: WEEKDAYS_PLUS_SAT }),
  electrician: buildDefaultHours({ open: '08:00', close: '18:00', days: WEEKDAYS_PLUS_SAT }),
  general_handyman: buildDefaultHours({ open: '08:00', close: '17:00', days: WEEKDAYS_ONLY }),
};
const DEFAULT_WORKING_HOURS = buildDefaultHours({ open: '08:00', close: '17:00', days: WEEKDAYS_ONLY });

// Timezone backstop: sms-confirm sets tenant_timezone during the wizard, but a
// tenant who skipped/raced that step keeps the DB default (America/Chicago).
// SG is single-timezone so it can be pinned safely here.
const COUNTRY_TIMEZONE_BACKSTOP = { SG: 'Asia/Singapore' };
const DB_DEFAULT_TIMEZONE = 'America/Chicago';

/**
 * A tenant "has a working number" only if phone_number is a valid E.164 string.
 * Live data holds junk like '' and '+12' that a plain NULL/falsy check misses,
 * so treat those as unprovisioned (both here and in the sweeper cron).
 */
export function isValidE164(phone) {
  return typeof phone === 'string' && /^\+[1-9]\d{7,14}$/.test(phone);
}

let twilioClient = null;
export function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

let resendClient = null;
export function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Route a freshly provisioned Twilio number to the AI receptionist.
 *
 * Design A (R2 fix): route inbound through the FastAPI webhook
 * (`RAILWAY_WEBHOOK_URL` + `/twilio/incoming-call`) so owner-pickup, VIP
 * routing, the working-hours schedule, and the outbound-minute cap — all
 * implemented ONLY in the livekit FastAPI webhook (`twilio_routes.py`) — run
 * for every newly provisioned tenant.
 *
 * Twilio precedence: a number associated with a SIP trunk IGNORES its
 * `voiceUrl` (the trunk's origination URI wins). So webhook routing requires
 * BOTH setting the voice/SMS URLs AND ensuring the number is NOT on the trunk.
 *
 * Fail-safe: with `RAILWAY_WEBHOOK_URL` unset we must NOT point a number at a
 * broken `voiceUrl` — fall back to the legacy trunk-only association (the AI
 * answers directly via the trunk's LiveKit origination; no owner-pickup / VIP /
 * schedule). This preserves the pre-fix behavior.
 *
 * Idempotent: Stripe retries reuse the same number — re-setting the URLs and
 * re-attempting the trunk removal (404 once already removed) are both no-ops.
 */
async function configureNumberRouting(client, phoneNumber, numberSid) {
  // SG inventory numbers arrive without a SID in hand — look it up by E.164.
  if (!numberSid) {
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    if (numbers.length === 0) {
      console.error(`[tenant-activation] Cannot configure routing — Twilio has no record of ${phoneNumber}`);
      return;
    }
    numberSid = numbers[0].sid;
  }

  const webhookBase = process.env.RAILWAY_WEBHOOK_URL;
  const trunkSid = process.env.TWILIO_SIP_TRUNK_SID;

  // Fail-safe: no webhook configured → legacy trunk-only routing.
  if (!webhookBase) {
    await associateWithTrunk(client, trunkSid, numberSid, phoneNumber, 'RAILWAY_WEBHOOK_URL unset — legacy trunk routing');
    return;
  }

  // Set the webhook URLs FIRST so the number stays routable the instant it
  // leaves the trunk (no unrouted window).
  try {
    await client.incomingPhoneNumbers(numberSid).update({
      voiceUrl: `${webhookBase}/twilio/incoming-call`,
      voiceMethod: 'POST',
      voiceFallbackUrl: `${webhookBase}/twilio/dial-fallback`,
      voiceFallbackMethod: 'POST',
      smsUrl: `${webhookBase}/twilio/incoming-sms`,
      smsMethod: 'POST',
    });
    console.log(`[tenant-activation] Routed ${phoneNumber} to FastAPI webhook (${webhookBase})`);
  } catch (urlErr) {
    // Couldn't set the URLs — keep the number answerable by falling back to the
    // trunk (AI-direct) rather than leaving a fresh number unrouted.
    console.error(`[tenant-activation] Failed to set webhook URLs on ${phoneNumber} — falling back to trunk:`, urlErr?.message);
    await associateWithTrunk(client, trunkSid, numberSid, phoneNumber, 'webhook URL set failed — trunk fallback');
    return;
  }

  // Disassociate from the trunk: trunk_sid wins over voiceUrl, so leaving it
  // would nullify the routing change. Idempotent — a number never on the trunk
  // (freshly purchased US/CA) returns 404, which is already the desired state.
  if (trunkSid) {
    try {
      await client.trunking.v1.trunks(trunkSid).phoneNumbers(numberSid).remove();
      console.log(`[tenant-activation] Disassociated ${phoneNumber} from SIP trunk`);
    } catch (trunkErr) {
      if (trunkErr?.status !== 404) {
        // Trunk still wins → webhook routing won't take effect. Loud but
        // non-fatal: the number still answers (AI-direct via the trunk).
        console.error(`[tenant-activation] Trunk disassociation failed for ${phoneNumber} (webhook routing inactive until removed):`, trunkErr?.message);
      }
    }
  }
}

/**
 * Associate a number with the Elastic SIP trunk — the legacy AI-direct routing
 * path, used only as the `RAILWAY_WEBHOOK_URL`-unset / URL-set-failed fallback.
 */
async function associateWithTrunk(client, trunkSid, numberSid, phoneNumber, reason) {
  if (!trunkSid) {
    console.warn(`[tenant-activation] ${phoneNumber} has no routing configured (no RAILWAY_WEBHOOK_URL, no TWILIO_SIP_TRUNK_SID) — ${reason}`);
    return;
  }
  try {
    await client.trunking.v1.trunks(trunkSid).phoneNumbers.create({ phoneNumberSid: numberSid });
    console.log(`[tenant-activation] Associated ${phoneNumber} with SIP trunk (${reason})`);
  } catch (trunkErr) {
    console.error(`[tenant-activation] SIP trunk association failed for ${phoneNumber} (${reason}):`, trunkErr?.message);
  }
}

/**
 * Provision a phone number based on tenant's country.
 * SG: Assign from phone_inventory via atomic RPC.
 * US/CA: Purchase via Twilio API.
 * Both then route to the AI receptionist via `configureNumberRouting`
 * (FastAPI webhook when `RAILWAY_WEBHOOK_URL` is set, else legacy SIP trunk).
 *
 * Returns the provisioned phone number string, or null on failure.
 */
async function provisionPhoneNumber(tenantId, country) {
  try {
    if (country === 'SG') {
      // Idempotency: assign_sg_number is NOT idempotent — a webhook re-run
      // after a crash-after-assign-before-tenant-update would burn a second
      // inventory number. Reuse any number already assigned to this tenant.
      const { data: existingSg } = await supabase
        .from('phone_inventory')
        .select('phone_number')
        .eq('assigned_tenant_id', tenantId)
        .eq('status', 'assigned')
        .limit(1)
        .maybeSingle();

      if (existingSg?.phone_number) {
        console.log(`[tenant-activation] Reusing previously assigned SG number ${existingSg.phone_number} for tenant ${tenantId}`);
        return existingSg.phone_number;
      }

      // Atomic assignment from pre-purchased inventory (D-11)
      const { data, error } = await supabase.rpc('assign_sg_number', {
        p_tenant_id: tenantId,
      });

      if (error) {
        console.error('[tenant-activation] SG assignment RPC error:', error);
        return null;
      }

      // data is an array of { phone_number } rows; empty = no available numbers
      if (!data || data.length === 0) {
        console.warn('[tenant-activation] No SG numbers available for tenant:', tenantId);
        return null;
      }

      const phoneNumber = data[0].phone_number;

      // Route the number to the AI receptionist. SG inventory numbers come
      // without a SID in hand — configureNumberRouting looks it up.
      await configureNumberRouting(getTwilioClient(), phoneNumber, null);

      return phoneNumber;
    } else if (country === 'US' || country === 'CA') {
      // Purchase number via Twilio API, then route it via configureNumberRouting
      // (FastAPI webhook + trunk disassociation, or trunk-only fallback).
      const client = getTwilioClient();

      // Idempotency: a webhook re-run after a crash-after-purchase-before-
      // tenant-update would buy a SECOND number. Numbers are tagged with the
      // tenant id via friendlyName at purchase; reuse a match if one exists.
      const tenantTag = `voco-tenant-${tenantId}`;
      let phoneNumber;
      let numberSid;
      try {
        const existing = await client.incomingPhoneNumbers.list({ friendlyName: tenantTag, limit: 1 });
        if (existing.length > 0) {
          phoneNumber = existing[0].phoneNumber;
          numberSid = existing[0].sid;
          console.log(`[tenant-activation] Reusing previously purchased Twilio number ${phoneNumber} for tenant ${tenantId}`);
        }
      } catch (listErr) {
        // Lookup failure must not block provisioning — worst case we fall
        // through to a fresh purchase (the pre-068 behavior).
        console.error('[tenant-activation] Twilio existing-number lookup failed:', listErr?.message);
      }

      if (!phoneNumber) {
        const purchasedNumber = await client.incomingPhoneNumbers.create({
          phoneNumberType: 'local',
          countryCode: country,
          friendlyName: tenantTag,
        });
        phoneNumber = purchasedNumber.phoneNumber; // E.164 format
        numberSid = purchasedNumber.sid;
        console.log(`[tenant-activation] Purchased Twilio number ${phoneNumber} (${country}) for tenant ${tenantId}`);
      }

      // Route the number to the AI receptionist (webhook routing when
      // RAILWAY_WEBHOOK_URL is set, else legacy trunk association).
      await configureNumberRouting(client, phoneNumber, numberSid);

      return phoneNumber;
    } else {
      // Unknown or null country — flag for admin instead of provisioning wrong country
      console.error('[tenant-activation] Cannot provision: unknown country for tenant:', tenantId, country);
      return null;
    }
  } catch (err) {
    console.error('[tenant-activation] Provisioning failed for tenant:', tenantId, err);
    return null;
  }
}

/**
 * Activate a paid/trialing tenant: seed working hours + timezone, then provision
 * a phone number and send the welcome (or failure) email. Idempotent and safe to
 * call from the webhook, the verify-checkout fallback, the sweeper, or a backfill.
 *
 * Does NOT set onboarding_complete or sync the subscription — the caller owns
 * billing fulfillment. Callers differ only in error posture:
 * - the webhook awaits this WITHOUT a catch, so a phone-write throw → 500 → Stripe
 *   retries (provisioning idempotency reuses the same number);
 * - the verify-checkout fallback wraps it in try/catch AFTER syncing billing, so a
 *   provisioning error can never block the billing rescue.
 *
 * @param {string} tenantId
 * @param {{ eventCreatedForTrial?: number }} opts  epoch-seconds anchor for the
 *   welcome email's trial-end date (Stripe event.created or session.created).
 */
export async function activateTenant(tenantId, { eventCreatedForTrial } = {}) {
  // Re-read the tenant fresh so this is a self-contained single source of truth.
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('country, phone_number, owner_email, owner_phone, business_name, working_hours, tenant_timezone, trade_type, provisioning_failed')
    .eq('id', tenantId)
    .single();

  if (!tenantRow) {
    console.warn(`[tenant-activation] Tenant ${tenantId} not found — cannot activate`);
    return;
  }

  // ── Activation seeding (2026-06-12 onboarding audit C2/C3) ────────────────
  // The wizard collects neither working hours nor timezone. Unseeded, the
  // tenant's AI cannot book a single appointment (zero slots) and all time
  // math runs in the DB-default America/Chicago. Seed refinable defaults.
  const seedFields = {};
  if (!tenantRow.working_hours) {
    seedFields.working_hours =
      DEFAULT_WORKING_HOURS_BY_TRADE[tenantRow.trade_type] || DEFAULT_WORKING_HOURS;
  }
  const tzBackstop = COUNTRY_TIMEZONE_BACKSTOP[tenantRow.country];
  if (tzBackstop && (!tenantRow.tenant_timezone || tenantRow.tenant_timezone === DB_DEFAULT_TIMEZONE)) {
    seedFields.tenant_timezone = tzBackstop;
  }
  if (Object.keys(seedFields).length > 0) {
    const { error: seedError } = await supabase
      .from('tenants')
      .update(seedFields)
      .eq('id', tenantId);
    if (seedError) {
      // Non-fatal: provisioning must still proceed, but an unseeded tenant can't
      // take bookings — make it loud.
      console.error('[tenant-activation] Failed to seed activation defaults:', seedError.message);
      Sentry.captureMessage(
        `Activation-defaults seed FAILED for tenant ${tenantId}: ${seedError.message} — tenant has no working hours and cannot take bookings`,
        'error',
      );
    } else {
      console.log(`[tenant-activation] Seeded activation defaults for tenant ${tenantId}:`, Object.keys(seedFields).join(', '));
    }
  }

  // ── Provisioning ──
  // Provision when the tenant has no VALID number ('', junk like '+12', or null
  // all count as unprovisioned). Concurrency guard: re-SELECT the number
  // immediately before provisioning and abort if another path (webhook vs
  // verify-checkout vs sweeper) just set it, so a race can't double-buy. (This
  // closes the common window; a full atomic claim would need a schema column and
  // is deferred — the friendlyName/inventory reuse in provisionPhoneNumber plus
  // the ~6s fallback poll delay make a true concurrent collision rare.)
  if (!isValidE164(tenantRow.phone_number)) {
    const { data: fresh } = await supabase
      .from('tenants')
      .select('phone_number')
      .eq('id', tenantId)
      .maybeSingle();
    if (isValidE164(fresh?.phone_number)) {
      console.log(`[tenant-activation] Tenant ${tenantId} already has a valid number — skipping provisioning`);
      return;
    }

    const provisionedNumber = await provisionPhoneNumber(tenantId, tenantRow.country);

    if (provisionedNumber) {
      const { error: phoneWriteError } = await supabase
        .from('tenants')
        .update({ phone_number: provisionedNumber, provisioning_failed: false })
        .eq('id', tenantId);
      if (phoneWriteError) {
        // The number exists in Twilio/inventory but the tenant row doesn't know
        // it. Throw so the webhook caller returns 500 and Stripe retries — the
        // provisioning idempotency pre-checks make the retry reuse this number.
        // (The verify-checkout caller catches this so billing is never blocked.)
        console.error('[tenant-activation] Failed to write provisioned number to tenant:', phoneWriteError.message);
        throw phoneWriteError;
      }
      console.log(`[tenant-activation] Provisioned ${provisionedNumber} for tenant ${tenantId} (${tenantRow.country})`);

      // Welcome email — the only direct delivery of the AI number to the
      // customer. Idempotent via billing_notifications. Failures logged, never thrown.
      if (tenantRow.owner_email) {
        try {
          const { data: alreadyWelcomed } = await supabase
            .from('billing_notifications')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('notification_type', 'welcome')
            .maybeSingle();

          if (!alreadyWelcomed) {
            const trialAnchorSec = eventCreatedForTrial || Math.floor(Date.now() / 1000);
            const trialEndDate = new Date((trialAnchorSec + 14 * 24 * 60 * 60) * 1000)
              .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            let prettyNumber = provisionedNumber;
            try {
              prettyNumber = formatInternational(provisionedNumber) || provisionedNumber;
            } catch {
              // formatting is cosmetic — fall back to raw E.164
            }
            await getResendClient().emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'support@voco.live',
              to: tenantRow.owner_email,
              subject: `Your AI receptionist is live — ${prettyNumber}`,
              react: WelcomeEmail({
                businessName: tenantRow.business_name || '',
                phoneNumber: prettyNumber,
                trialEndDate,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://voco.live'}/dashboard`,
              }),
            });
            await supabase.from('billing_notifications').upsert(
              {
                tenant_id: tenantId,
                notification_type: 'welcome',
                metadata: { phone_number: provisionedNumber },
              },
              { onConflict: 'tenant_id,notification_type', ignoreDuplicates: true }
            );
            console.log(`[tenant-activation] Welcome email sent to ${tenantRow.owner_email}`);
          }
        } catch (welcomeErr) {
          console.error('[tenant-activation] Failed to send welcome email:', welcomeErr?.message);
        }
      }
    } else {
      // Mark provisioning as failed for admin follow-up (Pitfall 4 from RESEARCH.md)
      await supabase
        .from('tenants')
        .update({ provisioning_failed: true })
        .eq('id', tenantId);
      console.error(`[tenant-activation] Provisioning failed for tenant ${tenantId} (${tenantRow.country}) — flagged for admin`);
      Sentry.captureMessage(
        `Phone provisioning FAILED for paying tenant ${tenantId} (country=${tenantRow.country || 'unknown'}) — admin must assign a number`,
        'error',
      );

      // Notify the business owner — idempotent via billing_notifications so
      // retries don't spam duplicate failure emails.
      if (tenantRow.owner_email) {
        try {
          const { data: alreadyNotified } = await supabase
            .from('billing_notifications')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('notification_type', 'provisioning_failed')
            .maybeSingle();

          if (!alreadyNotified) {
            await getResendClient().emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'support@voco.live',
              to: tenantRow.owner_email,
              subject: 'Action needed: Phone number setup requires attention',
              html: `<p>Hi${tenantRow.business_name ? ` ${tenantRow.business_name}` : ''},</p>
<p>Your Voco account is almost ready, but we couldn't automatically assign a phone number for your region (${tenantRow.country || 'unknown'}).</p>
<p>Our team has been notified and will resolve this shortly. If you need immediate assistance, reply to this email.</p>
<p>— The Voco Team</p>`,
            });
            await supabase.from('billing_notifications').upsert(
              {
                tenant_id: tenantId,
                notification_type: 'provisioning_failed',
                metadata: { country: tenantRow.country || null },
              },
              { onConflict: 'tenant_id,notification_type', ignoreDuplicates: true }
            );
            console.log(`[tenant-activation] Provisioning failure notification sent to ${tenantRow.owner_email}`);
          }
        } catch (emailErr) {
          console.error('[tenant-activation] Failed to send provisioning failure email:', emailErr?.message);
        }
      }
    }
  }
}
