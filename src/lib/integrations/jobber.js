/**
 * Jobber integration adapter — Phase 54 STUB.
 *
 * OAuth scope strings for Jobber are configured in the Developer Center UI at
 * developer.getjobber.com when the app is registered. They are NOT passed as a
 * `scope=` query param — the authorize endpoint surfaces the registered scopes.
 *
 * Phase 54 ships the getAuthUrl scaffold only. All other methods throw
 * NotImplementedError. Phase 56 wires real OAuth exchange, refresh, revoke,
 * and fetchCustomerByPhone (GraphQL).
 *
 * Source: https://developer.getjobber.com/docs/building_your_app/app_authorization/
 * @module integrations/jobber
 */

const JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const JOBBER_REVOKE_URL = 'https://api.getjobber.com/api/oauth/revoke';

/**
 * @implements {import('./types.js').IntegrationAdapter}
 */
export class JobberAdapter {
  constructor() {
    this.clientId = process.env.JOBBER_CLIENT_ID;
    this.clientSecret = process.env.JOBBER_CLIENT_SECRET;
  }

  /**
   * Build the Jobber OAuth authorize URL.
   * Scopes are configured per-app in the Jobber Developer Center — no scope query param.
   *
   * @param {string} stateParam - HMAC-signed OAuth state (tenantId + signature)
   * @param {string} redirectUri - Callback URL registered with Jobber
   * @returns {string}
   */
  getAuthUrl(stateParam, redirectUri) {
    const url = new URL(JOBBER_AUTH_URL);
    url.searchParams.set('client_id', this.clientId || '');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', stateParam);
    return url.toString();
  }

  async exchangeCode(code, redirectUri, extraParams = {}) {
    throw new Error('NotImplementedError: Jobber exchangeCode ships in Phase 56');
  }

  async refreshToken(tokenSet) {
    throw new Error('NotImplementedError: Jobber refreshToken ships in Phase 56');
  }

  async revoke(tokenSet) {
    throw new Error('NotImplementedError: Jobber revoke ships in Phase 56');
  }

  async fetchCustomerByPhone(tenantId, phone) {
    throw new Error('NotImplementedError: Jobber fetchCustomerByPhone ships in Phase 56');
  }
}
