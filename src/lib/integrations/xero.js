/**
 * Xero adapter implementation.
 * Uses xero-node SDK for OAuth 2.0 and API calls.
 *
 * @module accounting/xero
 */

import { XeroClient } from 'xero-node';

// Xero deprecated the legacy broad-access scope for apps created on/after
// 2026-03-02; granular scopes are required. This bundle covers:
//   - read + write invoices (push + read invoice context)
//   - read + write contacts (findOrCreateCustomer creates contacts during push)
//   - offline_access (refresh tokens)
// Source: https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0
const XERO_SCOPES = 'openid profile email accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read offline_access';

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
    const tokenSet = await xero.apiCallback(code);

    // After token exchange, get connected tenants (organizations)
    await xero.updateTenants();
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
   * Phase 54 stub. Phase 55 implements real fetch via xero-node getContacts +
   * getInvoices with phone filter + caching in use-cache wrapper.
   *
   * @param {string} tenantId
   * @param {string} phone
   * @returns {Promise<import('./types.js').CustomerContext>}
   */
  async fetchCustomerByPhone(tenantId, phone) {
    throw new Error('NotImplementedError: Xero fetchCustomerByPhone ships in Phase 55');
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
