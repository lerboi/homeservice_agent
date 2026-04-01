/**
 * QuickBooks Online adapter implementation.
 * Uses intuit-oauth for OAuth 2.0 and node-quickbooks for API calls.
 *
 * @module accounting/quickbooks
 */

import OAuthClient from 'intuit-oauth';
import QuickBooks from 'node-quickbooks';

const QBO_ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
const QBO_BASE_URL = QBO_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

/**
 * @implements {import('./types.js').AccountingAdapter}
 */
export class QuickBooksAdapter {
  constructor() {
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID;
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
    this.environment = QBO_ENVIRONMENT;
  }

  /**
   * Create an intuit-oauth client instance.
   * @private
   */
  _createOAuthClient(redirectUri) {
    return new OAuthClient({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      environment: this.environment,
      redirectUri,
    });
  }

  /**
   * Create a node-quickbooks SDK client for API calls.
   * @private
   */
  _createQBClient(realmId, accessToken) {
    return new QuickBooks(
      this.clientId,
      this.clientSecret,
      accessToken,
      false, // no token secret (OAuth 2.0)
      realmId,
      this.environment === 'sandbox',
      false, // debug
      null, // minor version
      '2.0', // OAuth version
      null, // refresh token (handled separately)
    );
  }

  /**
   * Generate QuickBooks OAuth 2.0 authorization URL.
   * @param {string} tenantId - Voco tenant ID (passed through state)
   * @param {string} redirectUri - OAuth callback URL
   * @returns {string} Authorization URL
   */
  getAuthUrl(tenantId, redirectUri) {
    const oauthClient = this._createOAuthClient(redirectUri);
    return oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: tenantId,
    });
  }

  /**
   * Exchange authorization code for tokens.
   * @param {string} code - Authorization code from callback
   * @param {string} redirectUri - OAuth callback URL
   * @param {Object} [extraParams] - Additional params (realmId from callback URL)
   * @returns {Promise<import('./types.js').TokenSet>}
   */
  async exchangeCode(code, redirectUri, extraParams = {}) {
    const oauthClient = this._createOAuthClient(redirectUri);
    const authResponse = await oauthClient.createToken(
      `${redirectUri}?code=${encodeURIComponent(code)}&realmId=${encodeURIComponent(extraParams.realmId || '')}`
    );

    const token = authResponse.getJson();

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: Date.now() + (token.expires_in * 1000),
      realm_id: extraParams.realmId || null,
      display_name: extraParams.displayName || null,
    };
  }

  /**
   * Refresh an expired access token.
   * @param {import('./types.js').TokenSet} tokenSet
   * @returns {Promise<import('./types.js').TokenSet>}
   */
  async refreshToken(tokenSet) {
    const oauthClient = this._createOAuthClient('');
    oauthClient.setToken({
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      token_type: 'bearer',
    });

    const authResponse = await oauthClient.refreshUsingToken(tokenSet.refresh_token);
    const token = authResponse.getJson();

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: Date.now() + (token.expires_in * 1000),
      realm_id: tokenSet.realm_id,
    };
  }

  /**
   * Find an existing QBO customer by email or create one.
   * @param {string} customerName
   * @param {string} customerEmail
   * @returns {Promise<string>} QBO Customer ID
   */
  async findOrCreateCustomer(customerName, customerEmail) {
    const qbo = this._qboClient;
    if (!qbo) throw new Error('QuickBooks client not initialized. Call setCredentials first.');

    return new Promise((resolve, reject) => {
      // Search by email
      qbo.findCustomers({
        fetchAll: false,
        PrimaryEmailAddr: customerEmail,
      }, (err, customers) => {
        if (err) return reject(err);

        if (customers?.QueryResponse?.Customer?.length > 0) {
          return resolve(String(customers.QueryResponse.Customer[0].Id));
        }

        // Not found — create new customer
        qbo.createCustomer({
          DisplayName: customerName,
          PrimaryEmailAddr: { Address: customerEmail },
        }, (createErr, customer) => {
          if (createErr) return reject(createErr);
          resolve(String(customer.Id));
        });
      });
    });
  }

  /**
   * Set credentials for API calls (called before pushInvoice/updateInvoiceStatus).
   * @param {Object} credentials - Row from accounting_credentials
   */
  setCredentials(credentials) {
    this._qboClient = this._createQBClient(credentials.realm_id, credentials.access_token);
    this._realmId = credentials.realm_id;
  }

  /**
   * Push an invoice to QuickBooks Online.
   * @param {import('./types.js').ExternalInvoice} invoice
   * @param {import('./types.js').ExternalLineItem[]} lineItems
   * @param {Object} settings - Invoice settings (tax_rate, etc.)
   * @returns {Promise<{externalId: string}>}
   */
  async pushInvoice(invoice, lineItems, settings) {
    const qbo = this._qboClient;
    if (!qbo) throw new Error('QuickBooks client not initialized. Call setCredentials first.');

    // Find or create customer
    const customerId = await this.findOrCreateCustomer(
      invoice.customerName,
      invoice.customerEmail
    );

    const qboInvoice = {
      CustomerRef: { value: customerId },
      Line: lineItems.map(item => ({
        DetailType: 'SalesItemLineDetail',
        Amount: item.quantity * item.unitPrice,
        Description: item.description,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.unitPrice,
        },
      })),
      DueDate: invoice.dueDate,
      DocNumber: invoice.invoiceNumber,
    };

    return new Promise((resolve, reject) => {
      qbo.createInvoice(qboInvoice, (err, result) => {
        if (err) return reject(err);
        resolve({ externalId: String(result.Id) });
      });
    });
  }

  /**
   * Update invoice status in QuickBooks (void or mark paid).
   * @param {string} externalId - QBO Invoice ID
   * @param {string} status - 'void' or 'paid'
   */
  async updateInvoiceStatus(externalId, status) {
    const qbo = this._qboClient;
    if (!qbo) throw new Error('QuickBooks client not initialized. Call setCredentials first.');

    if (status === 'void') {
      return new Promise((resolve, reject) => {
        // First fetch the invoice to get SyncToken
        qbo.getInvoice(externalId, (err, invoice) => {
          if (err) return reject(err);
          qbo.voidInvoice({ Id: externalId, SyncToken: invoice.SyncToken }, (voidErr) => {
            if (voidErr) return reject(voidErr);
            resolve();
          });
        });
      });
    }

    if (status === 'paid') {
      return new Promise((resolve, reject) => {
        // Record a payment against the invoice
        qbo.getInvoice(externalId, (err, invoice) => {
          if (err) return reject(err);
          qbo.createPayment({
            TotalAmt: invoice.TotalAmt,
            CustomerRef: invoice.CustomerRef,
            Line: [{
              Amount: invoice.TotalAmt,
              LinkedTxn: [{ TxnId: externalId, TxnType: 'Invoice' }],
            }],
          }, (payErr) => {
            if (payErr) return reject(payErr);
            resolve();
          });
        });
      });
    }
  }
}
