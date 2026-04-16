/**
 * Integration adapter interface and shared type definitions.
 * Every provider (xero, jobber) implements this shape.
 *
 * @module integrations/types
 */

/**
 * @typedef {Object} TokenSet
 * @property {string} access_token
 * @property {string} refresh_token
 * @property {number} [expiry_date] - Unix timestamp in milliseconds
 * @property {string[]} [scopes] - Granular OAuth scopes granted
 * @property {string} [xero_tenant_id] - Xero organization ID (Xero only)
 * @property {string} [display_name] - Company name from provider
 */

/**
 * @typedef {Object} ExternalInvoice
 * @property {string} customerName
 * @property {string} customerEmail
 * @property {Array<ExternalLineItem>} lineItems
 * @property {string} invoiceNumber
 * @property {string} issuedDate
 * @property {string} dueDate
 * @property {number} taxRate
 */

/**
 * @typedef {Object} ExternalLineItem
 * @property {string} description
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {boolean} taxable
 */

/**
 * @typedef {Object} CustomerContext
 * @property {Object|null} contact
 * @property {number} [outstandingBalance]
 * @property {Array<Object>} [lastInvoices]
 * @property {Array<Object>} [recentJobs]
 * @property {string|null} [lastPaymentDate]
 * @property {string|null} [lastVisitDate]
 */

/**
 * Unified integration adapter contract.
 *
 * OAuth lifecycle is mandatory for every adapter.
 * Read surface (fetchCustomerByPhone) is mandatory but may throw NotImplementedError
 * during the phase where the provider is still being wired (Phase 54 Jobber stub).
 * Push surface (pushInvoice / updateInvoiceStatus / findOrCreateCustomer) is optional —
 * only Xero implements it (Phase 35 legacy, gated by invoicing flag from Phase 53).
 *
 * @typedef {Object} IntegrationAdapter
 *
 * // OAuth lifecycle (mandatory)
 * @property {(stateParam: string, redirectUri: string) => string} getAuthUrl
 * @property {(code: string, redirectUri: string, extraParams?: Object) => Promise<TokenSet>} exchangeCode
 * @property {(tokenSet: TokenSet) => Promise<TokenSet>} refreshToken
 * @property {(tokenSet: TokenSet) => Promise<void>} revoke
 *
 * // Read surface (mandatory signature; may throw NotImplementedError)
 * @property {(tenantId: string, phone: string) => Promise<CustomerContext>} fetchCustomerByPhone
 *
 * // Push surface (optional — Xero only)
 * @property {(invoice: ExternalInvoice, lineItems: ExternalLineItem[], settings: Object) => Promise<{externalId: string}>} [pushInvoice]
 * @property {(externalId: string, status: string) => Promise<void>} [updateInvoiceStatus]
 * @property {(customerName: string, customerEmail: string) => Promise<string>} [findOrCreateCustomer]
 */

/** Supported integration providers — matches migration 052's CHECK constraint. */
export const PROVIDERS = ['xero', 'jobber'];
