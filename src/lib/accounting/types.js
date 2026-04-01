/**
 * Accounting adapter interface and shared type definitions.
 * All three platform adapters (QuickBooks, Xero, FreshBooks) implement this shape.
 *
 * @module accounting/types
 */

/**
 * @typedef {Object} TokenSet
 * @property {string} access_token
 * @property {string} refresh_token
 * @property {number} expiry_date - Unix timestamp in milliseconds
 * @property {string} [realm_id] - QuickBooks company/realm ID
 * @property {string} [xero_tenant_id] - Xero organization ID
 * @property {string} [account_id] - FreshBooks account ID
 * @property {string} [display_name] - Company name from accounting software
 */

/**
 * Shared shape for data mapped to external invoice format.
 * Each adapter maps FROM this shape TO platform-specific fields.
 *
 * @typedef {Object} ExternalInvoice
 * @property {string} customerName
 * @property {string} customerEmail
 * @property {Array<ExternalLineItem>} lineItems
 * @property {string} invoiceNumber
 * @property {string} issuedDate - ISO date string (YYYY-MM-DD)
 * @property {string} dueDate - ISO date string (YYYY-MM-DD)
 * @property {number} taxRate - Decimal (e.g. 0.0825 for 8.25%)
 */

/**
 * @typedef {Object} ExternalLineItem
 * @property {string} description
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {boolean} taxable
 */

/**
 * @typedef {Object} AccountingAdapter
 * @property {(invoice: ExternalInvoice, lineItems: ExternalLineItem[], settings: Object) => Promise<{externalId: string}>} pushInvoice
 * @property {(externalId: string, status: string) => Promise<void>} updateInvoiceStatus
 * @property {(tenantId: string, redirectUri: string) => string} getAuthUrl
 * @property {(code: string, redirectUri: string, extraParams?: Object) => Promise<TokenSet>} exchangeCode
 * @property {(tokenSet: TokenSet) => Promise<TokenSet>} refreshToken
 * @property {(customerName: string, customerEmail: string) => Promise<string>} findOrCreateCustomer
 */

/** Supported accounting providers */
export const PROVIDERS = ['quickbooks', 'xero', 'freshbooks'];
