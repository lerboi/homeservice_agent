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

// ─── Lazy-instantiated clients ────────────────────────────────────────────────

let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

let resendClient = null;
function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
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
  const body =
    `${businessName}: New ${urgency || 'routine'} lead -- ` +
    `${callerName || 'Unknown'}, ${jobType || 'General inquiry'} ` +
    `at ${address || 'No address'}. ` +
    `Call back: ${callbackLink} | Dashboard: ${dashboardLink}`;

  try {
    const result = await getTwilioClient().messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to,
    });
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
  const subject = `New ${lead?.urgency || 'routine'} lead -- ${lead?.caller_name || 'Unknown caller'}`;

  try {
    const result = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'alerts@homeservice.ai',
      to,
      subject,
      react: NewLeadEmail({ lead, businessName, dashboardUrl }),
    });
    console.log('[notifications] Owner email sent:', result?.id);
    return result;
  } catch (err) {
    console.error('[notifications] Owner email failed:', err?.message || err);
  }
}

// ─── Caller recovery SMS ──────────────────────────────────────────────────────

/**
 * Send warm recovery SMS to a caller who hung up without booking.
 *
 * @param {{ to: string, callerName?: string, businessName: string,
 *            bookingLink: string, ownerPhone: string }} params
 */
export async function sendCallerRecoverySMS({
  to,
  callerName,
  businessName,
  bookingLink,
  ownerPhone,
}) {
  const firstName = callerName?.split(' ')[0] || 'there';
  const body =
    `Hi ${firstName}, thanks for calling ${businessName}. ` +
    `We'd love to help -- book online at ${bookingLink} ` +
    `or call us back anytime at ${ownerPhone}.`;

  try {
    const result = await getTwilioClient().messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to,
    });
    console.log('[notifications] Caller recovery SMS sent:', result.sid);
    return result;
  } catch (err) {
    console.error('[notifications] Caller recovery SMS failed:', err?.message || err);
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
