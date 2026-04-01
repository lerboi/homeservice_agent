/**
 * FreshBooks adapter implementation.
 * Uses @freshbooks/api SDK for OAuth 2.0 and API calls.
 *
 * @module accounting/freshbooks
 */

import pkg from '@freshbooks/api';
const { Client: FreshBooksClient } = pkg;

/**
 * @implements {import('./types.js').AccountingAdapter}
 */
export class FreshBooksAdapter {
  constructor() {
    this.clientId = process.env.FRESHBOOKS_CLIENT_ID;
    this.clientSecret = process.env.FRESHBOOKS_CLIENT_SECRET;
  }

  /**
   * Generate FreshBooks OAuth 2.0 authorization URL.
   * @param {string} tenantId - Voco tenant ID (passed through state)
   * @param {string} redirectUri - OAuth callback URL
   * @returns {string} Authorization URL
   */
  getAuthUrl(tenantId, redirectUri) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: tenantId,
    });
    return `https://auth.freshbooks.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens.
   * @param {string} code - Authorization code from callback
   * @param {string} redirectUri - OAuth callback URL
   * @param {Object} [extraParams] - Additional params
   * @returns {Promise<import('./types.js').TokenSet>}
   */
  async exchangeCode(code, redirectUri, extraParams = {}) {
    // Use fetch for the token exchange since the FreshBooks SDK
    // expects to be instantiated with a token already
    const response = await fetch('https://api.freshbooks.com/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`FreshBooks token exchange failed: ${response.status} ${errorBody}`);
    }

    const token = await response.json();

    // Get the account ID from the /me endpoint
    const meResponse = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    let accountId = null;
    let displayName = null;
    if (meResponse.ok) {
      const meData = await meResponse.json();
      const membership = meData?.response?.business_memberships?.[0];
      accountId = membership?.business?.account_id || null;
      displayName = membership?.business?.name || null;
    }

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: Date.now() + (token.expires_in * 1000),
      account_id: accountId,
      display_name: displayName,
    };
  }

  /**
   * Refresh an expired access token.
   * @param {import('./types.js').TokenSet} tokenSet
   * @returns {Promise<import('./types.js').TokenSet>}
   */
  async refreshToken(tokenSet) {
    const response = await fetch('https://api.freshbooks.com/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: tokenSet.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`FreshBooks token refresh failed: ${response.status} ${errorBody}`);
    }

    const token = await response.json();

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: Date.now() + (token.expires_in * 1000),
      account_id: tokenSet.account_id,
    };
  }

  /**
   * Set credentials for API calls.
   * @param {Object} credentials - Row from accounting_credentials
   */
  setCredentials(credentials) {
    this._credentials = credentials;
    this._accountId = credentials.account_id;
    this._fbClient = new FreshBooksClient(credentials.access_token);
  }

  /**
   * Find an existing FreshBooks client by email or create one.
   * @param {string} customerName
   * @param {string} customerEmail
   * @returns {Promise<string>} FreshBooks client ID
   */
  async findOrCreateCustomer(customerName, customerEmail) {
    const fb = this._fbClient;
    if (!fb || !this._accountId) {
      throw new Error('FreshBooks client not initialized. Call setCredentials first.');
    }

    try {
      // Search clients by email
      const searchResult = await fb.clients.list(this._accountId, {
        search: { email: customerEmail },
      });

      const existingClients = searchResult?.data?.clients;
      if (existingClients?.length > 0) {
        return String(existingClients[0].id);
      }
    } catch (err) {
      // Search failed — proceed to create
      console.warn('[freshbooks] Client search failed, will create:', err?.message);
    }

    // Create new client
    const createResult = await fb.clients.create({
      fname: customerName.split(' ')[0] || customerName,
      lname: customerName.split(' ').slice(1).join(' ') || '',
      email: customerEmail,
      organization: customerName,
    }, this._accountId);

    return String(createResult?.data?.id);
  }

  /**
   * Push an invoice to FreshBooks.
   * @param {import('./types.js').ExternalInvoice} invoice
   * @param {import('./types.js').ExternalLineItem[]} lineItems
   * @param {Object} settings
   * @returns {Promise<{externalId: string}>}
   */
  async pushInvoice(invoice, lineItems, settings) {
    const fb = this._fbClient;
    if (!fb || !this._accountId) {
      throw new Error('FreshBooks client not initialized. Call setCredentials first.');
    }

    // Find or create customer
    const clientId = await this.findOrCreateCustomer(
      invoice.customerName,
      invoice.customerEmail,
    );

    const fbInvoice = {
      customerid: parseInt(clientId, 10),
      create_date: invoice.issuedDate,
      due_offset_days: 30,
      lines: lineItems.map(item => ({
        type: 0, // 0 = normal line item
        name: item.description?.substring(0, 40) || 'Service',
        description: item.description,
        qty: item.quantity,
        unit_cost: {
          amount: String(item.unitPrice),
          code: 'USD',
        },
      })),
    };

    const result = await fb.invoices.create(fbInvoice, this._accountId);
    const createdInvoice = result?.data;

    return { externalId: String(createdInvoice?.id || createdInvoice?.invoiceid) };
  }

  /**
   * Update invoice status in FreshBooks (void/delete or mark paid).
   * @param {string} externalId - FreshBooks invoice ID
   * @param {string} status - 'void' or 'paid'
   */
  async updateInvoiceStatus(externalId, status) {
    const fb = this._fbClient;
    if (!fb || !this._accountId) {
      throw new Error('FreshBooks client not initialized. Call setCredentials first.');
    }

    const invoiceId = parseInt(externalId, 10);

    if (status === 'void') {
      // FreshBooks: delete the invoice (moves to "deleted" status)
      await fb.invoices.delete(this._accountId, invoiceId);
      return;
    }

    if (status === 'paid') {
      // Mark as paid by creating a payment
      await fb.payments.create({
        invoiceid: invoiceId,
        amount: { amount: '0', code: 'USD' }, // Will be filled by FB from invoice total
        date: new Date().toISOString().split('T')[0],
        type: 'Other',
      }, this._accountId);
    }
  }
}
