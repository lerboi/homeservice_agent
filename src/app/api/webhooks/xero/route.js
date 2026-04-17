import crypto from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getIntegrationAdapter, refreshTokenIfNeeded } from '@/lib/integrations/adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Xero webhook handler — Phase 55 (XERO-03).
 *
 * HMAC-SHA256 of the raw body against XERO_WEBHOOK_KEY; timing-safe compare.
 * Bad sig → 401 (covers 3 of 4 intent-verify probes); good sig → 200.
 *
 * On valid INVOICE event: resolve invoice→contact→phones and invalidate
 * xero-context-${vocoTenantId}-${phoneE164} per phone. Falls back to the
 * broad xero-context-${vocoTenantId} tag on resolution failure.
 *
 * D-07: unknown Xero tenantId → silent 200 (prevents retry storms).
 */
export async function POST(request) {
  const rawBody = await request.text();
  const sig = request.headers.get('x-xero-signature');

  if (!sig || !process.env.XERO_WEBHOOK_KEY) {
    return new Response('', { status: 401 });
  }

  const expected = crypto
    .createHmac('sha256', process.env.XERO_WEBHOOK_KEY)
    .update(rawBody, 'utf8')
    .digest('base64');

  let valid = false;
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }
  if (!valid) {
    return new Response('', { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('', { status: 200 });
  }

  const events = Array.isArray(payload?.events) ? payload.events : [];
  if (events.length === 0) {
    return new Response('', { status: 200 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  for (const event of events) {
    const xeroOrgId = event?.tenantId;
    if (!xeroOrgId) continue;

    const { data: cred } = await admin
      .from('accounting_credentials')
      .select('*')
      .eq('provider', 'xero')
      .eq('xero_tenant_id', xeroOrgId)
      .maybeSingle();
    if (!cred) continue;

    const vocoTenantId = cred.tenant_id;
    let phones = [];

    if (event?.eventCategory === 'INVOICE' && event?.resourceId) {
      try {
        const adapter = await getIntegrationAdapter('xero');
        const refreshed = await refreshTokenIfNeeded(admin, cred);
        adapter.setCredentials(refreshed);

        const invResp = await adapter._xeroClient.accountingApi.getInvoices(
          xeroOrgId,
          undefined,
          undefined,
          undefined,
          [event.resourceId],
        );
        const inv = invResp.body?.invoices?.[0];
        const contactID = inv?.contact?.contactID;
        if (contactID) {
          const contactsResp = await adapter._xeroClient.accountingApi.getContacts(
            xeroOrgId,
            undefined,
            undefined,
            undefined,
            [contactID],
          );
          const contact = contactsResp.body?.contacts?.[0];
          phones = (contact?.phones || [])
            .map((p) => (p?.phoneNumber || '').trim())
            .filter(Boolean);
        }
      } catch {
        phones = [];
      }
    }

    if (phones.length === 0) {
      revalidateTag(`xero-context-${vocoTenantId}`);
    } else {
      for (const p of phones) {
        revalidateTag(`xero-context-${vocoTenantId}-${p}`);
      }
    }
  }

  return new Response('', { status: 200 });
}
