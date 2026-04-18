/**
 * Jobber webhook handler — Phase 56 Plan 03 (JOBBER-03).
 *
 * Security:
 *   - HMAC-SHA256 of the raw body keyed by JOBBER_CLIENT_SECRET (research
 *     Pitfall 1: Jobber derives the webhook HMAC key from the OAuth
 *     client_secret — there is NO separate webhook signing secret).
 *   - Raw body MUST be read once via `request.text()` BEFORE JSON.parse —
 *     calling request.json() and re-stringifying breaks HMAC verification
 *     (research anti-pattern).
 *   - 401 on bad signature; 200 on every other path (including unknown
 *     tenant, malformed body, resolve failure) to prevent Jobber's
 *     at-least-once delivery from retrying indefinitely (CONTEXT D-14 /
 *     P55 D-07 silent-ignore).
 *
 * No intent-verification handshake (research Pitfall 6 — unlike Xero,
 * Jobber does not probe newly-registered webhook endpoints).
 *
 * Behavior:
 *   - Resolve evt.accountId → Voco tenant via
 *     accounting_credentials.external_account_id (column added by P56 Plan 02
 *     migration 054).
 *   - Route by evt.topic:
 *       CLIENT_*  → itemId IS the clientId → query { client }
 *       JOB_*     → query { job { client } }
 *       VISIT_*   → query { job { client } } (visits route via parent job)
 *       INVOICE_* → query { invoice { client } }
 *   - Extract client.phones[].number → normalize to E.164 via
 *     libphonenumber-js → per-phone revalidateTag.
 *   - On ANY resolve failure (GraphQL throws, missing client, zero valid
 *     phones): fall back to the broad tenant tag.
 *
 * Never logs cred, tokens, or full error response bodies (research V7).
 */

import crypto from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { GraphQLClient, gql } from 'graphql-request';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { refreshTokenIfNeeded } from '@/lib/integrations/adapter';

const JOBBER_GRAPHQL_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_API_VERSION = '2024-04-01'; // keep in sync with src/lib/integrations/jobber.js
const DEFAULT_PHONE_REGION = 'US';

const RESOLVE_CLIENT_BY_ID = gql`
  query ResolveClient($id: EncodedId!) {
    client(id: $id) { id phones { number } }
  }
`;
const RESOLVE_CLIENT_FROM_JOB = gql`
  query ResolveJob($id: EncodedId!) {
    job(id: $id) { client { id phones { number } } }
  }
`;
const RESOLVE_CLIENT_FROM_INVOICE = gql`
  query ResolveInvoice($id: EncodedId!) {
    invoice(id: $id) { client { id phones { number } } }
  }
`;

function verifyHmac(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  const a = Buffer.from(signatureHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function normalizePhones(rawPhones) {
  return (rawPhones || [])
    .map((p) => parsePhoneNumberFromString(p?.number || '', DEFAULT_PHONE_REGION))
    .filter((p) => !!p && p.isPossible())
    .map((p) => p.format('E.164'));
}

/**
 * POST /api/webhooks/jobber
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function POST(request) {
  // Phase 1: auth (HMAC) — reject before any tenant lookup or body parse
  const rawBody = await request.text();
  const sig = request.headers.get('x-jobber-hmac-sha256');
  const secret = process.env.JOBBER_CLIENT_SECRET;
  if (!verifyHmac(rawBody, sig, secret)) {
    return new Response('', { status: 401 });
  }

  // From here on, respond 200 on ALL paths — Jobber retries on non-200.
  try {
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response('', { status: 200 });
    }
    const evt = payload?.data?.webHookEvent;
    if (!evt?.topic || !evt?.accountId || !evt?.itemId) {
      return new Response('', { status: 200 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // Resolve Jobber accountId → Voco tenant_id via Plan 02 migration 054's
    // provider-agnostic external_account_id column.
    const { data: cred } = await admin
      .from('accounting_credentials')
      .select('*')
      .eq('provider', 'jobber')
      .eq('external_account_id', evt.accountId)
      .maybeSingle();
    if (!cred) return new Response('', { status: 200 }); // silent-ignore unknown

    const vocoTenantId = cred.tenant_id;

    // Resolve topic → phones (requires a fresh token for Jobber GraphQL)
    let phones = [];
    try {
      const refreshed = await refreshTokenIfNeeded(admin, cred);
      const gqlClient = new GraphQLClient(JOBBER_GRAPHQL_URL, {
        headers: {
          Authorization: `Bearer ${refreshed.access_token}`,
          'X-JOBBER-GRAPHQL-VERSION': JOBBER_API_VERSION,
        },
      });

      const { topic, itemId } = evt;
      let rawPhones = [];
      if (topic.startsWith('CLIENT_')) {
        const r = await gqlClient.request(RESOLVE_CLIENT_BY_ID, { id: itemId });
        rawPhones = r?.client?.phones ?? [];
      } else if (topic.startsWith('JOB_') || topic.startsWith('VISIT_')) {
        const r = await gqlClient.request(RESOLVE_CLIENT_FROM_JOB, { id: itemId });
        rawPhones = r?.job?.client?.phones ?? [];
      } else if (topic.startsWith('INVOICE_')) {
        const r = await gqlClient.request(RESOLVE_CLIENT_FROM_INVOICE, { id: itemId });
        rawPhones = r?.invoice?.client?.phones ?? [];
      }
      // Unknown topic: rawPhones stays []; broad fallback below fires.

      phones = normalizePhones(rawPhones);
    } catch {
      phones = [];
    }

    if (phones.length === 0) {
      revalidateTag(`jobber-context-${vocoTenantId}`);
    } else {
      for (const phone of phones) {
        revalidateTag(`jobber-context-${vocoTenantId}-${phone}`);
      }
    }
    return new Response('', { status: 200 });
  } catch {
    // Any unexpected error — still respond 200 to prevent retry storms.
    // Do NOT log the error object (research V7 — may contain token material).
    return new Response('', { status: 200 });
  }
}
