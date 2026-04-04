/**
 * Notification service: Twilio SMS for owner alerts and caller recovery,
 * Resend email for owner alerts using React Email template.
 *
 * All functions use lazy-instantiated clients and try/catch non-throwing pattern —
 * notification failures are logged but must never crash the webhook handler.
 */

import twilio from 'twilio';
import { Resend } from 'resend';
import { NewLeadEmail } from '@/emails/NewLeadEmail';
import en from '../../messages/en.json' with { type: 'json' };
import es from '../../messages/es.json' with { type: 'json' };

// ─── Lazy-instantiated clients ────────────────────────────────────────────────

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

// ─── E.164 phone validation ──────────────────────────────────────────────────

/**
 * Validate E.164 phone number format: +{country code}{subscriber number}
 * Examples: +14155552671, +6512345678
 */
export function isValidE164(phone) {
  return typeof phone === 'string' && /^\+[1-9]\d{1,14}$/.test(phone);
}

// ─── Retry logic for transient errors ────────────────────────────────────────

/**
 * Twilio error codes that indicate permanent failures — never retry these.
 */
const PERMANENT_TWILIO_ERRORS = new Set([
  21211, // Invalid 'To' Phone Number
  21210, // Invalid 'From' Phone Number
  21612, // The 'To' phone number is not a valid mobile number
  21614, // 'To' number is not a valid mobile number
  21408, // Permission to send SMS not enabled for the region
  21610, // Message body is required
  21602, // Message body is required (variant)
  21608, // Account not authorized to call this number
]);

/**
 * Check if an error is transient and worth retrying.
 */
function isTransientError(err) {
  // Twilio permanent error codes — don't retry
  if (err?.code && PERMANENT_TWILIO_ERRORS.has(err.code)) return false;

  // HTTP status codes indicating transient issues
  const status = err?.status || err?.statusCode;
  if ([429, 503, 504].includes(status)) return true;

  // Network-level errors
  const code = err?.code;
  if (['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'].includes(code)) return true;

  // Twilio 429/5xx wrapped errors
  if (err?.code === 20429) return true; // Twilio rate limit

  return false;
}

/**
 * Retry wrapper with exponential backoff for transient errors.
 * Non-transient errors are thrown immediately without retry.
 */
async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !isTransientError(err)) throw err;
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }
  }
}

// ─── Owner SMS alert ──────────────────────────────────────────────────────────

/**
 * Send SMS alert to business owner with full lead details.
 *
 * @param {{ to: string, businessName: string, callerName?: string, jobType?: string,
 *            urgency?: string, address?: string, callbackLink: string, dashboardLink: string }} params
 */
export async function sendOwnerSMS({
  to,
  businessName,
  callerName,
  jobType,
  urgency,
  address,
  callbackLink,
  dashboardLink,
}) {
  if (!to) {
    console.warn('[notifications] sendOwnerSMS skipped: no phone number');
    return;
  }
  if (!isValidE164(to)) {
    console.warn(`[notifications] sendOwnerSMS skipped: invalid E.164 format "${to}"`);
    return;
  }

  const isEmergency = urgency === 'emergency';
  const name = callerName || 'Unknown';
  const job = jobType || 'General inquiry';
  const addr = address || 'No address';

  const body = isEmergency
    ? `EMERGENCY: ${businessName} — ${name} needs urgent ${job} at ${addr}. Call NOW: ${callbackLink} | Dashboard: ${dashboardLink}`
    : `${businessName}: New booking — ${name}, ${job} at ${addr}. Callback: ${callbackLink} | Dashboard: ${dashboardLink}`;

  try {
    const result = await withRetry(() =>
      getTwilioClient().messages.create({
        body,
        from: process.env.TWILIO_FROM_NUMBER,
        to,
      })
    );
    console.log('[notifications] Owner SMS sent:', result.sid);
    return result;
  } catch (err) {
    console.error('[notifications] Owner SMS failed:', err?.message || err);
  }
}

// ─── Owner email alert ────────────────────────────────────────────────────────

/**
 * Send formatted email alert to business owner using React Email template.
 *
 * @param {{ to: string, lead: object, businessName: string, dashboardUrl: string }} params
 */
export async function sendOwnerEmail({ to, lead, businessName, dashboardUrl }) {
  if (!to) {
    console.warn('[notifications] sendOwnerEmail skipped: no email');
    return;
  }

  const urgency = lead?.urgency_classification || lead?.urgency || 'routine';
  const isEmergency = urgency === 'emergency';
  const callerName = lead?.caller_name || 'Unknown caller';

  const subject = isEmergency
    ? `EMERGENCY: New booking — ${callerName}`
    : `New booking — ${callerName}`;

  try {
    const result = await withRetry(() =>
      getResendClient().emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'alerts@voco.live',
        to,
        subject,
        react: NewLeadEmail({ lead, businessName, dashboardUrl }),
      })
    );
    console.log('[notifications] Owner email sent:', result?.id);
    return result;
  } catch (err) {
    console.error('[notifications] Owner email failed:', err?.message || err);
  }
}

// ─── Caller recovery SMS ──────────────────────────────────────────────────────

/**
 * Send urgency-aware recovery SMS to a caller whose booking failed.
 * Returns structured result for delivery tracking (RECOVER-03).
 *
 * @param {{ to: string, callerName?: string, businessName: string,
 *           locale?: string, urgency?: string, bookingLink?: string }} params
 * @returns {Promise<{ success: boolean, sid?: string, error?: { code: string|number, message: string } }>}
 */
export async function sendCallerRecoverySMS({
  to,
  from,
  callerName,
  businessName,
  locale,
  urgency,
  bookingLink, // D-10: accepted but unused — placeholder for future SMS chatbot / booking page
}) {
  if (!to) {
    console.warn('[notifications] sendCallerRecoverySMS skipped: no phone number');
    return { success: false, error: { code: 'NO_PHONE', message: 'No phone number provided' } };
  }
  if (!isValidE164(to)) {
    console.warn(`[notifications] sendCallerRecoverySMS skipped: invalid E.164 format "${to}"`);
    return { success: false, error: { code: 'INVALID_PHONE', message: `Invalid E.164 phone number: ${to}` } };
  }

  const translations = (locale === 'es') ? es : en;
  const isEmergency = urgency === 'emergency';
  const firstName = callerName?.split(' ')[0] || 'there';

  // D-06: emergency = empathetic urgency (warm, time-sensitive acknowledgement)
  // D-07: routine = standard warm tone
  const templateKey = isEmergency
    ? 'recovery_sms_attempted_emergency'
    : 'recovery_sms_attempted_routine';

  const body = interpolate(translations.notifications[templateKey], {
    business_name: businessName || 'Your service provider',
    first_name: firstName,
  });

  try {
    const result = await withRetry(() =>
      getTwilioClient().messages.create({
        body,
        from: from || process.env.TWILIO_FROM_NUMBER,
        to,
      })
    );
    console.log('[notifications] Caller recovery SMS sent:', result.sid);
    return { success: true, sid: result.sid };
  } catch (err) {
    const code = err?.code || 'UNKNOWN';
    const message = err?.message || String(err);
    console.error('[notifications] Caller recovery SMS failed:', message);
    return { success: false, error: { code, message } };
  }
}

// ─── Interpolation helper ────────────────────────────────────────────────────

/**
 * Simple {key} placeholder interpolation. No external dependency —
 * per Phase 01 P03 decision: direct JSON import, no next-intl runtime.
 */
function interpolate(template, vars) {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{${key}}`, val ?? ''),
    template
  );
}

// ─── Caller booking confirmation SMS ─────────────────────────────────────────

/**
 * Send booking confirmation SMS to the caller in their detected language.
 * Fire-and-forget pattern — errors logged but never thrown.
 *
 * @param {{ to: string, businessName: string, date: string, time: string,
 *            address: string, locale: string }} params
 */
export async function sendCallerSMS({ to, from, businessName, date, time, address, locale }) {
  if (!to) {
    console.warn('[notifications] sendCallerSMS skipped: no phone number');
    return;
  }
  if (!isValidE164(to)) {
    console.warn(`[notifications] sendCallerSMS skipped: invalid E.164 format "${to}"`);
    return;
  }

  const translations = locale === 'es' ? es : en;
  const body = interpolate(translations.notifications.booking_confirmation, {
    business_name: businessName || 'Your service provider',
    date: date || '',
    time: time || '',
    address: address || '',
  });

  try {
    const result = await withRetry(() =>
      getTwilioClient().messages.create({
        body,
        from: from || process.env.TWILIO_FROM_NUMBER,
        to,
      })
    );
    console.log('[notifications] Caller SMS sent:', result.sid);
    return result;
  } catch (err) {
    console.error('[notifications] Caller SMS failed:', err?.message || err);
  }
}

// ─── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * Send both owner SMS and email notifications in parallel.
 * Uses Promise.allSettled — one failure does not prevent the other.
 *
 * @param {{ tenantId: string, lead: object, businessName: string,
 *            ownerPhone: string, ownerEmail: string }} params
 */
export async function sendOwnerNotifications({
  tenantId,
  lead,
  businessName,
  ownerPhone,
  ownerEmail,
}) {
  const callbackLink = `tel:${lead?.from_number}`;
  const dashboardLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'}/dashboard/leads`;
  const dashboardUrl = dashboardLink;

  const [smsResult, emailResult] = await Promise.allSettled([
    sendOwnerSMS({
      to: ownerPhone,
      businessName,
      callerName: lead?.caller_name,
      jobType: lead?.job_type,
      urgency: lead?.urgency_classification || lead?.urgency,
      address: lead?.address,
      callbackLink,
      dashboardLink,
    }),
    sendOwnerEmail({
      to: ownerEmail,
      lead,
      businessName,
      dashboardUrl,
    }),
  ]);

  const smsStatus = smsResult.status === 'fulfilled' ? 'ok' : `failed: ${smsResult.reason?.message}`;
  const emailStatus = emailResult.status === 'fulfilled' ? 'ok' : `failed: ${emailResult.reason?.message}`;

  console.log(
    `[notifications] Owner notifications for tenant ${tenantId}: SMS=${smsStatus}, email=${emailStatus}`
  );
}
