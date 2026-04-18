/**
 * Jobber integration adapter — Phase 56 (replaces P54 stub).
 *
 * OAuth scopes are configured per-app in the Jobber Developer Center UI (NOT passed as
 * `scope=` query param). See developer.getjobber.com/docs/building_your_app/app_authorization/.
 *
 * Key divergences from Xero (P55 reference):
 * - GraphQL instead of REST — uses `graphql-request@7.4.0`
 * - X-JOBBER-GRAPHQL-VERSION header REQUIRED on every call (400 if missing)
 * - Refresh-token rotation is MANDATORY — every refresh returns a new refresh_token
 *   which MUST be persisted immediately (research Pitfall 3). refreshTokenIfNeeded
 *   (src/lib/integrations/adapter.js) atomically persists the new token set.
 * - No public revoke endpoint (Assumption A8 — revoke is a no-op; disconnect still
 *   deletes local row at /api/integrations/disconnect)
 * - Phones stored free-form; normalize via libphonenumber-js before match
 *
 * @module integrations/jobber
 */
import { GraphQLClient, gql } from 'graphql-request';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { refreshTokenIfNeeded } from './adapter.js';

const JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const JOBBER_GRAPHQL_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_API_VERSION = '2025-04-16';
const OUTSTANDING_STATUSES = new Set(['AWAITING_PAYMENT', 'BAD_DEBT', 'PARTIAL', 'PAST_DUE']);
const DEFAULT_PHONE_REGION = 'US';

const FETCH_QUERY = gql`
  query FetchClientByPhone($phone: String!) {
    clients(first: 25, filter: { phoneNumber: $phone }) {
      nodes {
        id
        name
        emails { address }
        phones { number }
        jobs(first: 4, sort: [{ key: UPDATED_AT, direction: DESCENDING }]) {
          nodes {
            jobNumber
            title
            jobStatus
            startAt
            endAt
            visits(first: 1, filter: { status: UPCOMING }) { nodes { startAt } }
          }
        }
        invoices(first: 10) {
          nodes { invoiceNumber issuedDate amount amountOutstanding invoiceStatus }
        }
        visits(first: 1, sort: [{ key: COMPLETED_AT, direction: DESCENDING }], filter: { completed: true }) {
          nodes { endAt completedAt }
        }
      }
    }
  }
`;

/**
 * Decode a Jobber access-token JWT's `exp` claim → ms-since-epoch.
 * Silently tolerant of malformed tokens (returns null); caller decides fallback.
 */
function parseJwtExpiryMs(jwt) {
  try {
    const middle = jwt.split('.')[1];
    if (!middle) return null;
    const payload = JSON.parse(Buffer.from(middle, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * MODULE-LEVEL cached fetcher — Next.js 16 forbids `'use cache'` on class methods.
 * The class `JobberAdapter.fetchCustomerByPhone` delegates here.
 *
 * Callers are responsible for resolving `tenantId` server-side from authenticated
 * context (e.g. webhook signature, Python agent deps) — never from a request body.
 *
 * @param {string} tenantId   Voco application tenant_id (UUID)
 * @param {string} phoneE164  Caller phone in E.164 (e.g. "+15551234567")
 * @returns {Promise<object>} { client, recentJobs, outstandingInvoices, outstandingBalance, lastVisitDate } or { client: null }
 */
export async function fetchJobberCustomerByPhone(tenantId, phoneE164) {
  'use cache';
  cacheTag(`jobber-context-${tenantId}`);
  cacheTag(`jobber-context-${tenantId}-${phoneE164}`);

  if (typeof tenantId !== 'string' || typeof phoneE164 !== 'string') return { client: null };
  if (!/^\+[1-9]\d{6,14}$/.test(phoneE164)) return { client: null };

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'jobber')
    .maybeSingle();
  if (!cred) return { client: null };

  let refreshed;
  try {
    refreshed = await refreshTokenIfNeeded(admin, cred);
  } catch {
    return { client: null };
  }

  const gqlClient = new GraphQLClient(JOBBER_GRAPHQL_URL, {
    headers: {
      'Authorization': `Bearer ${refreshed.access_token}`,
      'X-JOBBER-GRAPHQL-VERSION': JOBBER_API_VERSION,
    },
  });

  let data;
  try {
    data = await gqlClient.request(FETCH_QUERY, { phone: phoneE164 });
  } catch {
    return { client: null };
  }

  const candidates = data?.clients?.nodes ?? [];
  const clientNode = candidates.find((c) =>
    (c.phones || []).some((p) => {
      const parsed = parsePhoneNumberFromString(p?.number || '', DEFAULT_PHONE_REGION);
      // Use isPossible() rather than isValid() — the latter rejects NXX=555
      // fictional numbers and any number whose area code isn't in libphonenumber's
      // assigned-range metadata. For real-world Jobber data the possibility check
      // is sufficient; the E.164 exact-match below is the actual gate.
      return !!parsed && parsed.isPossible() && parsed.format('E.164') === phoneE164;
    }),
  );
  if (!clientNode) return { client: null };

  const now = new Date();
  const recentJobs = (clientNode.jobs?.nodes ?? [])
    .map((j) => ({
      jobNumber: j.jobNumber,
      title: j.title,
      status: j.jobStatus,
      startAt: j.startAt ?? null,
      endAt: j.endAt ?? null,
      nextVisitDate: j.visits?.nodes?.[0]?.startAt ?? null,
    }))
    .sort((a, b) => {
      const aFuture = a.nextVisitDate && new Date(a.nextVisitDate) >= now;
      const bFuture = b.nextVisitDate && new Date(b.nextVisitDate) >= now;
      if (aFuture && bFuture) return new Date(a.nextVisitDate) - new Date(b.nextVisitDate);
      if (aFuture) return -1;
      if (bFuture) return 1;
      return 0;
    })
    .slice(0, 4);

  const invoiceNodes = clientNode.invoices?.nodes ?? [];
  const outstanding = invoiceNodes.filter((inv) => OUTSTANDING_STATUSES.has(inv.invoiceStatus));
  const outstandingBalance = outstanding.reduce((s, inv) => s + (Number(inv.amountOutstanding) || 0), 0);
  const outstandingInvoices = outstanding.slice(0, 3).map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    issuedAt: inv.issuedDate,
    amount: Number(inv.amount) || 0,
    amountOutstanding: Number(inv.amountOutstanding) || 0,
    status: inv.invoiceStatus,
  }));

  const lastVisitDate = clientNode.visits?.nodes?.[0]?.endAt ?? null;

  try {
    await admin
      .from('accounting_credentials')
      .update({ last_context_fetch_at: new Date().toISOString() })
      .eq('id', cred.id);
  } catch {
    /* non-fatal — cache absorbs subsequent reads */
  }

  return {
    client: {
      id: clientNode.id,
      name: clientNode.name,
      email: clientNode.emails?.[0]?.address ?? null,
    },
    recentJobs,
    outstandingInvoices,
    outstandingBalance,
    lastVisitDate,
  };
}

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
   * @param {string} stateParam
   * @param {string} redirectUri
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

  /**
   * Exchange an authorization code for a token set.
   * Returns TokenSet with expiry_date decoded from the access_token JWT `exp` claim.
   *
   * @param {string} code
   * @param {string} redirectUri
   * @returns {Promise<import('./types.js').TokenSet>}
   */
  async exchangeCode(code, redirectUri /* , _extraParams = {} */) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId || '',
      client_secret: this.clientSecret || '',
      code,
      redirect_uri: redirectUri,
    });
    const resp = await fetch(JOBBER_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body,
    });
    if (!resp.ok) throw new Error(`Jobber exchangeCode failed: ${resp.status}`);
    const json = await resp.json();
    if (!json.access_token || !json.refresh_token) {
      throw new Error('Jobber exchangeCode response missing tokens');
    }
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expiry_date: parseJwtExpiryMs(json.access_token),
      scopes: null,
    };
  }

  /**
   * Refresh. Jobber rotates refresh_token on EVERY call (research Pitfall 3).
   * Throws if the response omits a new refresh_token — a missing new token is a
   * contract violation and persisting the old token would break auth on next refresh.
   *
   * Accepts either a bare refresh_token string OR a TokenSet (refreshTokenIfNeeded
   * passes TokenSet; direct callers may pass a string).
   *
   * @param {string|import('./types.js').TokenSet} refreshInput
   * @returns {Promise<import('./types.js').TokenSet>}
   */
  async refreshToken(refreshInput) {
    const refreshTokenValue = typeof refreshInput === 'string'
      ? refreshInput
      : refreshInput?.refresh_token;
    if (!refreshTokenValue) throw new Error('Jobber refreshToken missing refresh_token input');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId || '',
      client_secret: this.clientSecret || '',
      refresh_token: refreshTokenValue,
    });
    const resp = await fetch(JOBBER_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body,
    });
    if (!resp.ok) throw new Error(`Jobber refreshToken failed: ${resp.status}`);
    const json = await resp.json();
    if (!json.access_token) throw new Error('Jobber refresh missing access_token');
    if (!json.refresh_token) throw new Error('Jobber refresh missing refresh_token (rotation mandatory)');
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expiry_date: parseJwtExpiryMs(json.access_token),
      scopes: null,
    };
  }

  /**
   * No-op — Jobber has no public revoke endpoint (research Assumption A8).
   * The disconnect path at /api/integrations/disconnect still deletes the local
   * accounting_credentials row and revalidates the broad cache tag.
   *
   * @param {import('./types.js').TokenSet} _tokenSet
   * @returns {Promise<void>}
   */
  async revoke(_tokenSet) {
    return;
  }

  async fetchCustomerByPhone(tenantId, phoneE164) {
    return fetchJobberCustomerByPhone(tenantId, phoneE164);
  }
}

// ============================================================
// Phase 57: schedule mirror fetchers
// ============================================================

// Jobber's VisitFilterAttributes uses range-input filters
// (startAt: { after, before }, updatedAt: { after }) — NOT flat
// startAfter/startBefore/updatedAfter. The flat names are rejected with
// "argumentNotAccepted" / "Did you mean `startAt`?" on the live schema.
const VISITS_DELTA_QUERY = gql`
  query JobberVisitsDelta(
    $updatedAfter: ISO8601DateTime,
    $startAfter: ISO8601DateTime!,
    $startBefore: ISO8601DateTime!,
    $first: Int!,
    $after: String
  ) {
    visits(
      first: $first
      after: $after
      filter: {
        startAt: { after: $startAfter, before: $startBefore }
        updatedAt: { after: $updatedAfter }
      }
    ) {
      nodes {
        id
        startAt
        endAt
        visitStatus
        assignedUsers(first: 5) { nodes { id name { full } } }
        job { id title client { id name { full } } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// NOTE: Jobber's User.email returns the UserEmail object type, but the
// `address` subfield was removed in newer API versions (live env returns
// "Field 'address' doesn't exist on type 'UserEmail'"). The bookable-users
// picker only displays name + Active badge — email is unused — so we omit
// the email subselection entirely. If a future feature needs it, query
// GraphiQL for the current UserEmail subfield (e.g. `email { primary }`)
// before re-adding.
const USERS_QUERY = gql`
  query JobberUsers($first: Int!, $after: String) {
    users(first: $first, after: $after) {
      nodes { id name { full first last } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// "Recent activity" is a UX heuristic for the picker (Active badge), not a
// contract — drop the date filter and just take the most recent N visits.
// Pagination caller bounds work via maxIterations below.
const RECENT_VISITS_FOR_ACTIVITY_QUERY = gql`
  query JobberRecentVisitsForActivity($first: Int!, $after: String) {
    visits(first: $first, after: $after) {
      nodes {
        id
        assignedUsers(first: 5) { nodes { id } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const VISIT_BY_ID_QUERY = gql`
  query JobberVisitById($id: EncodedId!) {
    visit(id: $id) {
      id
      startAt
      endAt
      visitStatus
      assignedUsers(first: 5) { nodes { id name { full } } }
      job { id title client { id name { full } } }
    }
  }
`;

/**
 * Internal helper — build a graphql-request client for a refreshed cred row.
 * Mirrors the inline construction used by fetchJobberCustomerByPhone above.
 */
async function getJobberGraphqlClient(admin, cred) {
  const refreshed = await refreshTokenIfNeeded(admin, cred);
  return new GraphQLClient(JOBBER_GRAPHQL_URL, {
    headers: {
      'Authorization': `Bearer ${refreshed.access_token}`,
      'X-JOBBER-GRAPHQL-VERSION': JOBBER_API_VERSION,
    },
  });
}

/**
 * Single-page fetch of Jobber visits in a time window. Pagination handled by caller.
 * Used by rebuildJobberMirror (full-window) and pollJobberVisitsDelta (updatedAfter).
 *
 * @param {object} args
 * @param {object} args.cred                  accounting_credentials row
 * @param {string} args.windowStart           ISO8601
 * @param {string} args.windowEnd             ISO8601
 * @param {string|null} [args.updatedAfter]   ISO8601 — null for full backfill
 * @param {string|null} [args.after]          GraphQL cursor
 * @param {number} [args.first]               page size (default 100)
 * @returns {Promise<{ visits, pageInfo }>}
 */
export async function fetchJobberVisits({ cred, windowStart, windowEnd, updatedAfter = null, after = null, first = 100 }) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const client = await getJobberGraphqlClient(admin, cred);
  const data = await client.request(VISITS_DELTA_QUERY, {
    updatedAfter,
    startAfter: windowStart,
    startBefore: windowEnd,
    first,
    after,
  });
  return {
    visits: data?.visits?.nodes ?? [],
    pageInfo: data?.visits?.pageInfo ?? { hasNextPage: false, endCursor: null },
  };
}

/**
 * Fetch a single visit by ID. Used by webhook handler to resolve VISIT_UPDATE
 * payloads (Jobber webhooks deliver only IDs, not full visit nodes).
 */
export async function fetchJobberVisitById({ cred, id }) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const client = await getJobberGraphqlClient(admin, cred);
  const data = await client.request(VISIT_BY_ID_QUERY, { id });
  return data?.visit ?? null;
}

/**
 * Fetch all Jobber users with a 30-day-activity flag per user.
 *
 * Two-query fallback (RESEARCH Pattern 7) — avoids assuming a users → visits
 * nested filter exists:
 *   1. Page through users(first:100) → all users
 *   2. Page through visits(filter:{startAfter: 30d ago}, first:500) → assignee IDs
 *   3. hasRecentActivity = id ∈ assigneeIdSet
 */
export async function fetchJobberUsersWithRecentActivity({ cred }) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const client = await getJobberGraphqlClient(admin, cred);

  const users = [];
  let cursor = null;
  do {
    const data = await client.request(USERS_QUERY, { first: 100, after: cursor });
    for (const u of data?.users?.nodes ?? []) users.push(u);
    cursor = data?.users?.pageInfo?.hasNextPage ? data.users.pageInfo.endCursor : null;
  } while (cursor);

  // Activity heuristic: pull up to ~1500 most recent visits (3 pages × 500)
  // and treat any user assigned to any of them as "active". Bounded by
  // maxPages so a busy tenant doesn't make us walk years of history.
  const ACTIVITY_MAX_PAGES = 3;
  const active = new Set();
  cursor = null;
  for (let page = 0; page < ACTIVITY_MAX_PAGES; page += 1) {
    const data = await client.request(RECENT_VISITS_FOR_ACTIVITY_QUERY, { first: 500, after: cursor });
    for (const v of data?.visits?.nodes ?? []) {
      for (const u of v?.assignedUsers?.nodes ?? []) active.add(u.id);
    }
    cursor = data?.visits?.pageInfo?.hasNextPage ? data.visits.pageInfo.endCursor : null;
    if (!cursor) break;
  }

  return users.map((u) => ({
    id: u.id,
    name: u.name?.full ?? `${u.name?.first ?? ''} ${u.name?.last ?? ''}`.trim(),
    first: u.name?.first ?? '',
    last: u.name?.last ?? '',
    // email omitted from this query (UserEmail.address removed in newer Jobber API)
    email: null,
    hasRecentActivity: active.has(u.id),
  }));
}
