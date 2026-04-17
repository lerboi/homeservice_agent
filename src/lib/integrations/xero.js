/**
 * Xero adapter implementation.
 * Uses xero-node SDK for OAuth 2.0 and API calls.
 *
 * @module accounting/xero
 */

import { XeroClient } from 'xero-node';
import { cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { refreshTokenIfNeeded } from './adapter.js';

// Xero deprecated the legacy broad-access scope for apps created on/after
// 2026-03-02; granular scopes are required. This bundle covers:
//   - read + write invoices (push + read invoice context)
//   - read + write contacts (findOrCreateCustomer creates contacts during push)
//   - offline_access (refresh tokens)
// Source: https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0
const XERO_SCOPES = 'openid profile email accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read offline_access';

/**
 * Digits-only comparator for Xero phone matching.
 *
 * Xero stores phones three ways depending on how the user entered them:
 *   1. Full string in PhoneNumber (e.g. "+15551234567", "(555) 123-4567", "555-1234")
 *   2. Split across PhoneCountryCode + PhoneAreaCode + PhoneNumber ("1" / "555" / "1234567")
 *   3. Mix of the above
 *
 * We extract digits from all three fields, concatenate, and compare the last 10
 * digits against the E.164 caller's last 10. Looser than strict E.164 equality
 * but far more robust against real-world Xero data — the 10-digit local number
 * is globally unique enough within a tenant for caller-context resolution.
 *
 * Returns true iff at least one of the contact's phones has matching digits.
 */
export function xeroContactMatchesPhone(contact, phoneE164) {
  const targetTen = phoneE164.replace(/\D/g, '').slice(-10);
  if (targetTen.length < 7) return false;  // too short to be meaningful
  const phones = Array.isArray(contact?.phones) ? contact.phones : [];
  for (const p of phones) {
    const parts = [
      p?.phoneCountryCode || '',
      p?.phoneAreaCode || '',
      p?.phoneNumber || '',
    ].join('');
    const digits = parts.replace(/\D/g, '');
    if (!digits) continue;
    if (digits.slice(-10) === targetTen) return true;
  }
  return false;
}

/**
 * Module-level cached caller-context fetcher. Next.js 16 does NOT allow
 * `'use cache'` on class instance methods, so the cached surface lives here
 * and XeroAdapter.fetchCustomerByPhone delegates to it.
 *
 * Contract identical to XeroAdapter.fetchCustomerByPhone — see that method's
 * JSDoc for cache semantics, security, and return shape.
 */
export async function fetchXeroCustomerByPhone(tenantId, phoneE164) {
  'use cache';
  cacheTag(`xero-context-${tenantId}`);
  cacheTag(`xero-context-${tenantId}-${phoneE164}`);

  if (typeof tenantId !== 'string' || typeof phoneE164 !== 'string') {
    return { contact: null };
  }
  if (!/^\+[1-9]\d{6,14}$/.test(phoneE164)) {
    return { contact: null };
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'xero')
    .maybeSingle();
  if (!cred) return { contact: null };

  let refreshed;
  try {
    refreshed = await refreshTokenIfNeeded(admin, cred);
  } catch {
    return { contact: null };
  }
  const xeroOrgId = refreshed.xero_tenant_id;
  if (!xeroOrgId) return { contact: null };

  // Build XeroClient inline — static/module-level, no `this` available.
  const xero = new XeroClient({
    clientId: process.env.XERO_CLIENT_ID,
    clientSecret: process.env.XERO_CLIENT_SECRET,
    redirectUris: [''],
    scopes: XERO_SCOPES.split(' '),
  });
  xero.setTokenSet({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    token_type: 'Bearer',
  });

  const lastTen = phoneE164.replace(/\D/g, '').slice(-10);
  let contactsResp;
  try {
    contactsResp = await xero.accountingApi.getContacts(
      xeroOrgId,
      undefined,
      `Phones[0].PhoneNumber.Contains("${lastTen}")`,
    );
  } catch {
    return { contact: null };
  }
  const candidates = contactsResp.body?.contacts || [];
  const contact = candidates.find((c) => xeroContactMatchesPhone(c, phoneE164));
  if (!contact) return { contact: null };

  let outstandingResp;
  try {
    outstandingResp = await xero.accountingApi.getInvoices(
      xeroOrgId,
      undefined,
      `Status=="AUTHORISED" AND Contact.ContactID==guid("${contact.contactID}") AND AmountDue>0`,
    );
  } catch {
    outstandingResp = { body: { invoices: [] } };
  }
  const outstandingInvoices = outstandingResp.body?.invoices || [];
  const outstandingBalance = outstandingInvoices.reduce(
    (sum, inv) => sum + (Number(inv.amountDue) || 0),
    0,
  );

  let recentResp;
  try {
    recentResp = await xero.accountingApi.getInvoices(
      xeroOrgId,
      undefined,
      `(Status=="AUTHORISED" OR Status=="PAID") AND Contact.ContactID==guid("${contact.contactID}")`,
      'Date DESC',
      undefined,
      1,
    );
  } catch {
    recentResp = { body: { invoices: [] } };
  }
  const allRecent = recentResp.body?.invoices || [];
  const lastInvoices = allRecent.slice(0, 3).map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    date: inv.date,
    total: inv.total,
    amountDue: inv.amountDue,
    status: inv.status,
    reference: inv.reference,
  }));

  const paidDates = allRecent
    .filter((inv) => inv.status === 'PAID' && inv.fullyPaidOnDate)
    .map((inv) => inv.fullyPaidOnDate);
  const lastPaymentDate = paidDates.length > 0
    ? paidDates.sort().at(-1)
    : null;

  await admin
    .from('accounting_credentials')
    .update({ last_context_fetch_at: new Date().toISOString() })
    .eq('id', cred.id);

  return { contact, outstandingBalance, lastInvoices, lastPaymentDate };
}

/**
 * @implements {import('./types.js').IntegrationAdapter}
 */
export class XeroAdapter {
  constructor() {
    this.clientId = process.env.XERO_CLIENT_ID;
    this.clientSecret = process.env.XERO_CLIENT_SECRET;
  }

  /**
   * Create a configured XeroClient instance.
   * @private
   */
  _createXeroClient(redirectUri) {
    return new XeroClient({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUris: [redirectUri],
      scopes: XERO_SCOPES.split(' '),
    });
  }

  /**
   * Generate Xero OAuth 2.0 authorization URL.
   * @param {string} state - HMAC-signed state (from signOAuthState)
   * @param {string} redirectUri - OAuth callback URL
   * @returns {Promise<string>} Authorization URL
   */
  async getAuthUrl(state, redirectUri) {
    const xero = this._createXeroClient(redirectUri);
    const consentUrl = await xero.buildConsentUrl();
    const url = new URL(consentUrl);
    url.searchParams.set('state', state);
    return url.toString();
  }

  /**
   * Exchange authorization code for tokens and select Xero tenant.
   * @param {string} code - Authorization code from callback
   * @param {string} redirectUri - OAuth callback URL
   * @param {Object} [extraParams] - Additional params
   * @returns {Promise<import('./types.js').TokenSet>}
   */
  async exchangeCode(code, redirectUri, extraParams = {}) {
    const xero = this._createXeroClient(redirectUri);
    const callbackUrl = `${redirectUri}?code=${encodeURIComponent(code)}`;
    const tokenSet = await xero.apiCallback(callbackUrl);

    // Pass `false` to skip the extra GET /Organisation call — that endpoint
    // requires the `accounting.settings` scope, which we don't request. The
    // /connections response alone gives us tenantId + tenantName.
    await xero.updateTenants(false);
    const tenants = xero.tenants;

    // Auto-select first tenant (most users have one organization)
    const selectedTenant = tenants?.[0];

    // Populate scopes from Xero's token response. `xero-node` exposes `scope`
    // as a space-delimited string after `apiCallback`. Fall back to the static
    // XERO_SCOPES bundle (what we requested) if the grant response omits it.
    const scopeString = tokenSet.scope || '';

    return {
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      expiry_date: tokenSet.expires_at
        ? tokenSet.expires_at * 1000
        : Date.now() + (tokenSet.expires_in * 1000),
      xero_tenant_id: selectedTenant?.tenantId || null,
      display_name: selectedTenant?.tenantName || null,
      scopes: scopeString ? scopeString.split(' ') : XERO_SCOPES.split(' '),
    };
  }

  /**
   * Refresh an expired access token.
   * @param {import('./types.js').TokenSet} tokenSet
   * @returns {Promise<import('./types.js').TokenSet>}
   */
  async refreshToken(tokenSet) {
    const xero = this._createXeroClient('');
    xero.setTokenSet({
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      token_type: 'Bearer',
    });

    const newTokenSet = await xero.refreshToken();

    return {
      access_token: newTokenSet.access_token,
      refresh_token: newTokenSet.refresh_token,
      expiry_date: newTokenSet.expires_at
        ? newTokenSet.expires_at * 1000
        : Date.now() + (newTokenSet.expires_in * 1000),
      xero_tenant_id: tokenSet.xero_tenant_id,
      scopes: XERO_SCOPES.split(' '),
    };
  }

  /**
   * Revoke Xero OAuth tokens upstream.
   * Per Xero docs: POST https://identity.xero.com/connect/revocation
   * with client_id, client_secret, and token. Revokes the refresh token
   * (and its access tokens) at the Xero identity provider.
   *
   * @param {import('./types.js').TokenSet} tokenSet
   * @returns {Promise<void>}
   */
  async revoke(tokenSet) {
    if (!tokenSet?.refresh_token) return;
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    try {
      await fetch('https://identity.xero.com/connect/revocation', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token: tokenSet.refresh_token }).toString(),
      });
    } catch (err) {
      console.error('[xero] revoke failed (non-fatal, row will still be deleted):', err.message);
    }
  }

  /**
   * Fetch caller context from Xero by phone (E.164). Phase 55 D-01..D-05.
   *
   * Returns { contact, outstandingBalance, lastInvoices, lastPaymentDate } on
   * match; returns { contact: null } uniformly when:
   *   - tenant has no accounting_credentials row for provider='xero' (disconnected)
   *   - token refresh fails (Plan 05 owns the error_state write on the refresh path)
   *   - no Xero contact's phone exactly matches phoneE164 (post-filter)
   *   - phoneE164 is malformed
   *   - any Xero API call throws (never rethrow out of a cached function)
   *
   * Caching: `'use cache'` MUST be the FIRST statement (known pitfall — silently
   * disables otherwise). Two-tier cacheTag (D-05):
   *   - xero-context-${tenantId}                 broad, invalidated on disconnect/reauth
   *   - xero-context-${tenantId}-${phoneE164}    specific, invalidated by Plan 04 webhook
   *
   * Security: callers (LiveKit Python agent, internal Next.js consumers) must
   * resolve `tenantId` from authenticated context, never from request bodies.
   *
   * @param {string} tenantId   Voco tenant_id (UUID)
   * @param {string} phoneE164  E.164 phone, e.g. "+15551234567"
   * @returns {Promise<import('./types.js').CustomerContext>}
   */
  async fetchCustomerByPhone(tenantId, phoneE164) {
    // Delegate to the module-level cached function. Next.js 16 does NOT allow
    // `'use cache'` on class instance methods — see fetchXeroCustomerByPhone
    // above for the cached implementation.
    return fetchXeroCustomerByPhone(tenantId, phoneE164);
  }

  /**
   * Set credentials for API calls.
   * @param {Object} credentials - Row from accounting_credentials
   */
  setCredentials(credentials) {
    this._credentials = credentials;
    this._xeroTenantId = credentials.xero_tenant_id;
    this._xeroClient = this._createXeroClient('');
    this._xeroClient.setTokenSet({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      token_type: 'Bearer',
    });
  }

  /**
   * Find an existing Xero contact by email or create one.
   * @param {string} customerName
   * @param {string} customerEmail
   * @returns {Promise<string>} Xero ContactID
   */
  async findOrCreateCustomer(customerName, customerEmail) {
    const xero = this._xeroClient;
    if (!xero) throw new Error('Xero client not initialized. Call setCredentials first.');

    // Search contacts by email
    const contactsResponse = await xero.accountingApi.getContacts(
      this._xeroTenantId,
      undefined, // ifModifiedSince
      `EmailAddress=="${customerEmail}"`,
    );

    const existingContacts = contactsResponse.body?.contacts;
    if (existingContacts?.length > 0) {
      return existingContacts[0].contactID;
    }

    // Create new contact
    const createResponse = await xero.accountingApi.createContacts(
      this._xeroTenantId,
      {
        contacts: [{
          name: customerName,
          emailAddress: customerEmail,
        }],
      },
    );

    return createResponse.body?.contacts?.[0]?.contactID;
  }

  /**
   * Push an invoice to Xero.
   * @param {import('./types.js').ExternalInvoice} invoice
   * @param {import('./types.js').ExternalLineItem[]} lineItems
   * @param {Object} settings
   * @returns {Promise<{externalId: string}>}
   */
  async pushInvoice(invoice, lineItems, settings) {
    const xero = this._xeroClient;
    if (!xero) throw new Error('Xero client not initialized. Call setCredentials first.');

    // Find or create customer contact
    const contactId = await this.findOrCreateCustomer(
      invoice.customerName,
      invoice.customerEmail,
    );

    const xeroInvoice = {
      type: 'ACCREC', // Accounts receivable (customer invoice)
      contact: { contactID: contactId },
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitPrice,
        accountCode: '200', // Default sales revenue account
      })),
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.invoiceNumber,
      status: 'AUTHORISED', // Xero: AUTHORISED = approved/sent
    };

    const response = await xero.accountingApi.createInvoices(
      this._xeroTenantId,
      { invoices: [xeroInvoice] },
    );

    const createdInvoice = response.body?.invoices?.[0];
    return { externalId: createdInvoice?.invoiceID };
  }

  /**
   * Update invoice status in Xero (void or mark paid).
   * @param {string} externalId - Xero InvoiceID
   * @param {string} status - 'void' or 'paid'
   */
  async updateInvoiceStatus(externalId, status) {
    const xero = this._xeroClient;
    if (!xero) throw new Error('Xero client not initialized. Call setCredentials first.');

    if (status === 'void') {
      await xero.accountingApi.updateInvoice(
        this._xeroTenantId,
        externalId,
        { invoices: [{ invoiceID: externalId, status: 'VOIDED' }] },
      );
      return;
    }

    if (status === 'paid') {
      // Fetch the invoice to get total
      const invoiceResponse = await xero.accountingApi.getInvoice(
        this._xeroTenantId,
        externalId,
      );
      const inv = invoiceResponse.body?.invoices?.[0];

      // Create a payment
      await xero.accountingApi.createPayment(
        this._xeroTenantId,
        {
          invoice: { invoiceID: externalId },
          account: { code: '090' }, // Default bank account code
          amount: inv?.total || inv?.amountDue,
          date: new Date().toISOString().split('T')[0],
        },
      );
    }
  }
}
