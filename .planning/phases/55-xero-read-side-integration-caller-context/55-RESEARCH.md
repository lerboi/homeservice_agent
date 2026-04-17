# Phase 55: Xero read-side integration (caller context) — Research

**Researched:** 2026-04-17 (regenerated after destructive overwrite of original)
**Domain:** Xero OAuth + read APIs, Next.js 16 caching, Xero webhooks (HMAC + intent-verify), LiveKit Python agent prompt injection + tool factories, Supabase service-role cross-runtime token-refresh
**Confidence:** HIGH on Next.js side (existing P54 code verified); MEDIUM-HIGH on Xero protocol details (cited official docs); MEDIUM on Python livekit-agent shape (separate cross-repo at `C:/Users/leheh/.Projects/livekit-agent/` — not directly readable from this monorepo)

---

## Project Constraints (from CLAUDE.md)

- **Brand name:** Voco — never "HomeService AI" / "homeserviceai". Email fallback domain: `voco.live`.
- **Skill-sync rule:** Read the relevant skill before changes; update it after. P55 touches `voice-call-architecture`, `auth-database-multitenancy`, `dashboard-crm-system`, `payment-architecture`, `nextjs-16-complete-guide`, `onboarding-flow` — all must be re-read before code edits and updated after Plan 08.
- **All DB tables documented in `auth-database-multitenancy`.** `accounting_credentials` is the canonical table for Xero/Jobber tokens.
- **Tech-stack pin:** Next.js 16 (App Router) + Supabase + Twilio SIP + LiveKit + Gemini 3.1 Flash Live (Python on Railway) + Resend. Don't introduce alternatives.
- **livekit-agent runs in a SEPARATE Python repo** at `C:/Users/leheh/.Projects/livekit-agent/` (`lerboi/livekit_agent` on GitHub). Not in this monorepo. Plans 06 + 07 are explicitly cross-repo (`autonomous: false`).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area A — Caller-context fetch shape**
- **D-01:** E.164 exact phone match via Xero Contacts. No normalization fallback. Filter shape per CONTEXT: `WHERE Phones.PhoneNumber=="${phoneE164}"`. (See Pitfall 1 — adapted to `Contains()` candidate + JS post-filter for E.164 equality, because the literal `==` filter against `Phones.PhoneNumber` is unreliable in OData.)
- **D-02:** `outstandingBalance` = sum `AmountDue` across `Status=AUTHORISED AND AmountDue>0`. `lastInvoices` = 3 most recent in `(AUTHORISED, PAID)`. `lastPaymentDate` = `MAX(FullyPaidOnDate)` across PAID. DRAFT/SUBMITTED/VOIDED excluded.
- **D-03:** `lastInvoices` shape = 3 entries, fields: `invoiceNumber, date, total, amountDue, status, reference`. No line items.
- **D-04:** Python `_run_db_queries` → `asyncio.wait_for(..., timeout=0.8)`. On timeout/exception: `customer_context=None`, Sentry capture with `tenant_id` + hashed-phone tag.

**Area B — Caching + webhook invalidation**
- **D-05:** Two-tier cacheTag: broad `xero-context-${tenantId}` + specific `xero-context-${tenantId}-${phoneE164}`.
- **D-06:** Webhook resolves invoice → contact → phones → per-phone `revalidateTag`. Fallback to broad on resolution failure. Extra Xero round-trip stays on webhook path, NEVER on call hot path.
- **D-07:** Single app-level `XERO_WEBHOOK_KEY`. HMAC-SHA256 verify. Bad sig → 401. Good sig but unknown tenant → silent 200 (prevents Xero retry storms). Handles intent-verify handshake.

**Area C — Prompt injection + tool + privacy**
- **D-08:** Pre-session block + tool re-serve. Xero fetch awaited before `session.start()` resolves greeting. CRITICAL RULE framing matching anti-hallucination section, near top of prompt.
- **D-09:** `check_customer_account()` returns STATE + DIRECTIVE string (NOT speakable English) per `feedback_livekit_prompt_philosophy.md`.
- **D-10:** Silent awareness; never volunteer. Mirror `check_caller_history.py:107-117`. "Do you have my info?" → confirm presence without specifics ("we have your contact on file").
- **D-11:** No-match → omit `customer_context` block entirely. Tool returns locked no-match string `"STATE: no_xero_contact_for_phone. DIRECTIVE: Treat as new or walk-in customer..."`. Same shape for disconnected case.

**Area D — Owner-facing edge UX**
- **D-12:** `connect_xero` checklist item ships in P55. Auto-detected by `accounting_credentials` row presence. P58 only polishes copy/ordering.
- **D-13:** Disconnect = AlertDialog confirm → revoke at Xero → delete row → `revalidateTag('xero-context-${tenantId}')`. Reuse P54-shipped dialog copy verbatim.
- **D-14:** Token-refresh failure surfacing = BOTH banner AND email (deliberate user override of recommended). Persist `error_state` on row, send Resend email with locked subject "Your Xero connection needs attention", banner with Reconnect primary + Disconnect secondary.
- **D-15:** Card content: connected status + subtle `last_context_fetch_at` timestamp + Disconnect button; error state = banner + Reconnect primary + Disconnect secondary; disconnected = existing P54.

### Claude's Discretion

- Python SDK choice (`xero-python` vs raw `httpx`).
- Exact `customer_context` prompt wording (structure locked, copy free).
- `last_context_fetch_at` update cadence.
- `error_state` schema shape (column vs JSONB vs separate table).
- Webhook idempotency (table vs trust Xero + idempotent `revalidateTag`).
- Webhook event subscription scope (INVOICE-only vs INVOICE + CONTACT).
- `lastInvoices` ordering (`Date` vs `UpdatedDateUTC`).
- Python integration module exact path inside livekit-agent repo (`src/integrations/xero.py` recommended).
- `check_customer_account()` mid-call re-fetch semantics.
- Resend email tone (match `billing_notifications`).

### Deferred Ideas (OUT OF SCOPE)

- Xero multi-org picker (auto-select first org continues).
- Xero rate-limit back-off layer.
- Xero contact-creation on caller match-fail.
- Python SDK swap if first choice proves awkward.
- `check_customer_account` force-refresh parameter.
- Deep telemetry (match rate, duration, cache hit) — CTX-01 in P58.
- Explicit connection-state hint in prompt.
- Webhook subscription to CONTACT events.
- Rename `accounting_credentials` → `integration_credentials`.
- RLS-tightening audit on `accounting_credentials`.
- VIP caller routing interaction with `customer_context`.
- Shared `integrations/xero` module between Python and Node (intentional duplication).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **XERO-01** | Tenant connects Xero via OAuth from `/dashboard/more/integrations`; tokens stored in `accounting_credentials` with `provider='xero'`; refresh-aware token getter handles expiry | Architecture (Next.js side) — OAuth callback flow + `refreshTokenIfNeeded` already in `src/lib/integrations/adapter.js:42`; Plan 03 wires it. Pitfall 6 — auto-flip invoicing inheritance. Pitfall 7 — `error_state` schema. |
| **XERO-02** | `fetchCustomerByPhone(tenantId, phone)` returns `{ contact, outstandingBalance, lastInvoices, lastPaymentDate }` from Xero in <500ms p95 with 5-min `'use cache'` TTL | Standard Stack (xero-node, next/cache); Architecture (Next.js side) — `'use cache'` directive placement + two-tier cacheTag; Pitfall 1 (phone filter syntax — CRITICAL); Code Examples Example 1. |
| **XERO-03** | `/api/webhooks/xero` invalidates tenant's customer-context cache on invoice/payment events via `revalidateTag` | Architecture (Next.js side) — webhook HMAC + intent-verify handshake; Pitfall 2 — Xero sends 4 probes. Code Examples Example 2. |
| **XERO-04** | During an inbound call, the LiveKit agent fetches Xero context (parallel with tenant DB read), injects a non-empty `customer_context` section into the system prompt, and exposes `check_customer_account()` as a tool | Architecture (Python side) — `_run_db_queries` 4-task parallel pattern + `customer_context` prompt block + `check_customer_account` tool; Pitfall 4 — 800ms hot-path budget. Code Examples Examples 3-5. |

</phase_requirements>

---

## Summary

Phase 55 turns the Phase 54 Xero scaffolding into a live, end-to-end caller-context integration on two surfaces: the Next.js dashboard side (real OAuth, real `fetchCustomerByPhone`, webhook invalidation, owner-facing card states) and the Python livekit-agent side (cross-repo: a parallel Xero fetch in `_run_db_queries` with an 800ms budget, a `customer_context` block in the system prompt, and a `check_customer_account()` tool).

The **most consequential research finding** is Pitfall 1: D-01's specified filter syntax `WHERE Phones.PhoneNumber=="${phoneE164}"` is not the documented working shape for Xero's Contacts API. Xero's OData filter on `Phones[]` requires indexed access (`Phones[0].PhoneNumber`) and the `==` operator on raw phone strings is historically buggy. Both Plans 02 (Next.js) and 06 (Python) implement the **adapted** approach: use `Phones[0].PhoneNumber.Contains("<lastTen>")` as a candidate filter, then enforce E.164 exact equality in JS/Python across all 4 phone slots (DEFAULT/MOBILE/FAX/DDI).

The **second-most-consequential finding** is the cross-runtime token-refresh race (Pitfall 5): both Next.js and Python can refresh the same Xero token. Without write-back-on-refresh from the Python side, the Next.js side sees stale tokens and re-refreshes, which Xero's refresh-token rotation can fail. Plan 06 explicitly persists access_token + refresh_token + expiry_date together on every refresh.

**Primary recommendation:** Implement exactly per the Plans. Run a one-shot manual test of the phone filter against the Xero demo company before Plan 02 + Plan 06 lock the fetcher. Honor the 800ms hot-path budget rigorously — never let Xero block the greeting.

---

## Standard Stack

### Core (Next.js side)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `xero-node` | ^9.x (already pinned by P54) | Xero OAuth + Accounting API client | Official SDK; handles `XeroClient`, `apiCallback`, `updateTenants`, `refreshToken`, `getContacts`, `getInvoices`. P54 already uses it [VERIFIED: src/lib/integrations/xero.js:8] |
| Next.js | 16.x (P54 enabled `cacheComponents: true`) | App Router + `'use cache'` + `cacheTag` + `revalidateTag` | Voco's framework; `'use cache'` is the canonical caching primitive [CITED: nextjs-16-complete-guide skill, P54 D-10] |
| `@supabase/supabase-js` | ^2.x | Service-role reads/writes of `accounting_credentials` | Standard project DAL |
| `next/cache` | (built-in) | `cacheTag`, `revalidateTag` | Built-in [VERIFIED: src/lib/integrations/status.js — P54 already uses this loop] |
| Node `crypto` | (built-in) | HMAC-SHA256 + `timingSafeEqual` for webhook verify | Stdlib; matches the Stripe webhook handler pattern at `src/app/api/stripe/webhook/route.js` |
| Resend | already integrated | D-14 token-refresh-failure email | Existing helper `getResendClient()` in `src/lib/notifications.js` [VERIFIED: project skill `payment-architecture`] |
| React Email | already integrated | `XeroReconnectEmail` template | Existing pattern under `src/emails/` |
| `date-fns` | already used by `CalendarSyncCard.js` | `formatDistanceToNow` for "Last synced X ago" line | Project-standard |

### Core (Python side — separate livekit-agent repo)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | ^0.27 (verify in livekit-agent's `pyproject.toml`/`requirements.txt`; add if missing) | Async Xero REST + token refresh | Tighter timeout control on the 800ms hot path than `xero-python`; smaller dep footprint; only 3 endpoints needed [Open Question 4 RESOLVED → raw httpx] |
| `supabase` (Python client) | already in livekit-agent | Service-role reads/writes of `accounting_credentials` | Existing `get_supabase_admin()` in `livekit-agent/src/supabase_client.py` |
| `sentry_sdk` | already in livekit-agent (assumed) | Capture 800ms timeout failures with tenant_id + hashed phone tags | D-04 references Sentry; treat as available [ASSUMED — A5] |
| `livekit-agents` | **1.5.1 (PINNED)** | `@function_tool` decorator for `check_customer_account` | Per `feedback_livekit_prompt_philosophy.md` — do NOT bump |
| `livekit-plugins-google` | **@43d3734 (PINNED)** | LiveKit + Gemini glue | Per `feedback_livekit_prompt_philosophy.md` — do NOT bump |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | already used | `AlertTriangle`, `Loader2`, optional `Clock`/`CheckCircle2` icons in card | Icons in Reconnect-needed banner |
| shadcn `Alert` / `AlertDescription` | install if missing | Reconnect-needed banner (Pattern from `CalendarSyncCard.js`) | Per UI-SPEC §Component Inventory |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `httpx` (Python) | `xero-python` SDK | xero-python brings typed models but adds dep; raw httpx gives explicit timeout control — critical on 800ms budget. Plan 06 picked httpx. |
| Two-tier cacheTag | Tenant-wide only | Tenant-wide wastes recompute on every webhook for active tenants. Two-tier is strictly better at negligible tag-string cost. |
| Pre-session prompt block | Post-greeting `generate_reply` injection | Post-greeting risks hallucination window on first turn. Pre-session adds 800ms to greeting (mitigated by D-04 cap). |
| STATE+DIRECTIVE tool return | Prose summary | Prose triggers parrot loop (LLM recites verbatim). STATE+DIRECTIVE forces translation. Per LiveKit prompt philosophy memory. |
| Dedicated `error_state` column | JSONB flag, separate table | Open Question 3 → dedicated `TEXT NULL` column. Simplest, queryable, easy to clear. Plan 01 ships migration `053_xero_error_state.sql`. |
| Dedicated `xero_webhook_events` table | None (idempotent revalidateTag) | Open Question 5 → skip table for P55. revalidateTag is idempotent; volume is low. Add in P58 if telemetry shows duplicate processing. |

**Installation:** No new npm packages on Next.js side beyond what P54 already installed. On Python side, verify `httpx>=0.27` in `livekit-agent/pyproject.toml`.

**Version verification:**
```bash
npm view xero-node version    # confirm ^9.x
```
P54 already pinned the Xero SDK; do not bump in P55.

---

## Architecture (Next.js side)

### Recommended Project Structure

P54 already established the layout:

```
src/
├── lib/integrations/
│   ├── xero.js          # P54 — adapter; P55 ADDS fetchCustomerByPhone
│   ├── jobber.js        # P54 — stub; untouched in P55
│   ├── adapter.js       # P54 — getIntegrationAdapter + refreshTokenIfNeeded
│   ├── status.js        # P54 — 'use cache' + cacheTag template (read-only reference)
│   └── types.js         # P54 — adapter contract
├── app/
│   ├── api/
│   │   ├── integrations/
│   │   │   ├── [provider]/
│   │   │   │   ├── auth/route.js       # P54 scaffold; P55 wires Xero
│   │   │   │   └── callback/route.js   # P54 scaffold; P55 wires Xero + clears error_state + revalidateTag
│   │   │   ├── disconnect/route.js     # P54; P55 ADDS Xero revoke + xero-context revalidateTag
│   │   │   └── status/route.js         # P54 — read-only reference
│   │   ├── webhooks/
│   │   │   └── xero/route.js           # P55 NEW — HMAC + intent-verify + per-phone revalidateTag
│   │   └── setup-checklist/route.js    # P54; P55 APPENDS connect_xero item
│   └── dashboard/more/integrations/page.js  # P54 server component; P55 passes error_state + last_context_fetch_at
├── components/dashboard/
│   └── BusinessIntegrationsClient.jsx  # P54 single client; P55 ADDS Reconnect banner + last-synced timestamp
├── lib/
│   └── notifications.js                # P54 has getResendClient; P55 ADDS notifyXeroRefreshFailure
├── emails/
│   └── XeroReconnectEmail.jsx          # P55 NEW — React Email template
└── supabase/migrations/
    └── 053_xero_error_state.sql        # P55 NEW — error_state TEXT NULL column + partial index
```

[VERIFIED: file listings of `src/app/api/integrations/`, `src/lib/integrations/`, `supabase/migrations/`]

### Pattern 1: `'use cache'` + two-tier `cacheTag` + `revalidateTag` loop (D-05)

**What:** Wrap the Xero fetch in a Next.js 16 cached function with two tags so the disconnect path can wipe ALL of a tenant's caches with one tag and the webhook path can surgically invalidate just the affected caller.
**When to use:** Any tenant-scoped read that must self-heal on external state change.
**Example:** [VERIFIED: existing P54 pattern at `src/lib/integrations/status.js`]

```javascript
// src/lib/integrations/xero.js — Phase 55 NEW METHOD
async fetchCustomerByPhone(tenantId, phoneE164) {
  'use cache';                                            // MUST be FIRST statement (Pitfall: silent disable)
  cacheTag(`xero-context-${tenantId}`);                   // broad — invalidated on disconnect/reauth
  cacheTag(`xero-context-${tenantId}-${phoneE164}`);      // specific — invalidated by webhook per phone
  // ...lookup logic...
  return { contact, outstandingBalance, lastInvoices, lastPaymentDate };
}
```

### Pattern 2: OAuth callback heals `error_state` + invalidates broad cacheTag

When the owner reconnects after a token-refresh failure (or switches Xero orgs), the callback MUST:
1. Upsert tokens into `accounting_credentials` (existing P54 behavior).
2. Set `error_state = NULL` (P55 NEW — heals the row).
3. Call `revalidateTag('xero-context-${tenantId}')` (P55 NEW — wipes any stale Org-A cache before Org-B data flows in).
4. **Preserve** P54's auto-flip of `tenants.features_enabled.invoicing = true` at lines 71-86 (Pitfall 6 — confirmed dialog already warns).

[VERIFIED: src/app/api/integrations/[provider]/callback/route.js:60-99 (lines 71-86 = invoicing auto-flip)]

### Pattern 3: Webhook handler — HMAC + intent-verify + invoice→phone resolution

```
POST /api/webhooks/xero
  ├─ rawBody = await request.text()        # MUST be raw bytes; never request.json() first
  ├─ HMAC-SHA256(rawBody, XERO_WEBHOOK_KEY) → base64
  ├─ crypto.timingSafeEqual(sig, expected) → 401 on mismatch (intent-verify probes 1-3)
  ├─ JSON.parse(rawBody)
  └─ for event in payload.events:
       ├─ resolve event.tenantId (Xero org) → vocoTenantId via accounting_credentials.xero_tenant_id
       ├─ if no row → silent 200 (D-07 prevents Xero retry storms)
       ├─ if INVOICE event with resourceId:
       │    ├─ getInvoices(ids=[resourceId]) → contact.contactID
       │    ├─ getContacts(ids=[contactID]) → phones[].phoneNumber
       │    └─ for each phone: revalidateTag(`xero-context-${vocoTenantId}-${phone}`)
       └─ on resolution failure / no phones: revalidateTag(`xero-context-${vocoTenantId}`)  # broad fallback
  └─ return 200 (always — Xero retries on non-200)
```

[VERIFIED: existing pattern at `src/app/api/stripe/webhook/route.js` for raw-body + signature verify; P55 implements per Code Example 2]

### Pattern 4: `connect_xero` setup checklist item (D-12)

Append to existing `/api/setup-checklist/route.js`:
- `VALID_ITEM_IDS` — append `'connect_xero'`
- `THEME_GROUPS.voice` — append `'connect_xero'` [Open Question 6 RESOLVED → `voice` theme; Xero feeds the AI receptionist]
- `ITEM_META.connect_xero = { title: 'Connect Xero', description: '...', href: '/dashboard/more/integrations' }`
- `fetchChecklistState` — parallel query: `accounting_credentials WHERE provider='xero' AND tenant_id=$1` count
- `deriveChecklistItems` — `autoComplete.connect_xero = !!state.xeroConnected`

### Anti-Patterns to Avoid

- **Storing `'use cache'` after any other statement** — silently disables caching with no error. P54 D-10 pitfall.
- **`request.json()` before HMAC verify** — body-stream consumed twice; HMAC computed over a re-stringified shape that doesn't match Xero's bytes → all signatures fail.
- **Logging `cred` or full `err.response` on Xero errors** — response bodies may echo refresh tokens.
- **Per-tenant webhook secrets** — Xero models webhook keys at the app level; per-tenant would invent a key-distribution layer for nothing.
- **Replacing P54's invoicing-auto-flip with conditional logic** — would surprise downstream Phase 56 Jobber connect flow which expects the same invariant.
- **Adding `accounting.settings` scope** — P54 explicitly skips `getOrganisations()` by passing `false` to `updateTenants(false)` to avoid needing this scope. Don't reintroduce. [VERIFIED: src/lib/integrations/xero.js:67-69]

---

## Architecture (Python side — cross-repo)

> **All paths in this section are inside the SEPARATE livekit-agent repo at `C:/Users/leheh/.Projects/livekit-agent/` (GitHub `lerboi/livekit_agent`).** Plans 06 + 07 are `autonomous: false` — user copies file contents into that repo manually.

### Recommended Module Layout

```
livekit-agent/
├── src/
│   ├── agent.py                      # MODIFY (~line 316 — _run_db_queries)
│   ├── prompt.py                     # MODIFY — add customer_context kwarg + block
│   ├── supabase_client.py            # READ — get_supabase_admin()
│   ├── lib/
│   │   └── phone.py                  # READ — _normalize_phone (E.164)
│   ├── integrations/                 # NEW package (Plan 06)
│   │   ├── __init__.py               # NEW
│   │   └── xero.py                   # NEW — fetch_xero_customer_by_phone + refresh write-back
│   └── tools/
│       ├── __init__.py               # MODIFY — register check_customer_account
│       ├── check_caller_history.py   # READ — TEMPLATE (factory pattern, silent-awareness phrasing at lines 107-117)
│       └── check_customer_account.py # NEW — Plan 07
└── tests/
    ├── test_xero_integration.py      # NEW — Plan 06
    ├── test_agent_xero_timeout.py    # NEW — Plan 06
    ├── test_check_customer_account.py # NEW — Plan 07
    └── test_prompt_customer_context.py # NEW — Plan 07
```

### Pattern 1: `_run_db_queries` 4-task parallel + 800ms-bounded Xero task (D-04, D-08)

The existing function (~line 316) already runs 3 tasks in parallel via `asyncio.gather(..., return_exceptions=True)`:
1. `subscription` lookup
2. `intake` questions
3. `call_record` insert

Plan 06 adds a 4th task **wrapped in `asyncio.wait_for(..., timeout=0.8)`**:

```python
xero_context_task = asyncio.create_task(
    asyncio.wait_for(
        fetch_xero_customer_by_phone(deps.tenant_id, from_number),
        timeout=0.8,
    )
)

results = await asyncio.gather(
    sub_task, intake_task, call_task, xero_context_task,
    return_exceptions=True,
)

# results[3] is the Xero task — handle separately
xero_result = results[3]
customer_context = None
if isinstance(xero_result, (asyncio.TimeoutError, Exception)):
    if SENTRY_AVAILABLE:
        sentry_sdk.capture_exception(xero_result, tags={
            "tenant_id": deps.tenant_id,
            "phone_hash": hashlib.sha256(from_number.encode()).hexdigest()[:8],
            "phase": "55", "component": "xero_context_fetch",
        })
elif xero_result is not None:
    customer_context = xero_result

return {
    'subscription': ...,
    'intake': ...,
    'call_record': ...,
    'customer_context': customer_context,   # P55 — None when no match / timeout / error
}
```

**Critical:** `_run_db_queries` is awaited BEFORE `session.start()` resolves the greeting — so the system prompt already contains the `customer_context` block by the time the agent speaks. This is D-08's "pre-session injection" path.

### Pattern 2: `customer_context` prompt block (D-08, D-10)

In `prompt.py` `build_system_prompt(...)`, add `customer_context: Optional[dict] = None` kwarg. When non-None, inject **immediately AFTER** the existing anti-hallucination CRITICAL RULE section, near the top of the prompt. Use `format_customer_context_state(ctx)` (defined in `tools/check_customer_account.py` for DRY between prompt + tool):

```python
if customer_context is not None:
    prompt += "\n\n# Caller Account Context (CRITICAL RULE)\n"
    prompt += format_customer_context_state(customer_context)
    prompt += (
        "\n\nCRITICAL RULE: Treat the STATE above as silent background knowledge. "
        "NEVER volunteer the contact name, outstanding balance, invoice details, or payment history. "
        "Ask every question and gather every fact as if you have no records, UNLESS the caller "
        "explicitly asks about their account, bill, or recent work. If they do ask, follow the "
        "DIRECTIVE precisely. If they ask 'do you have my info?', confirm presence WITHOUT specifics: "
        "say 'we have your contact on file' and offer to help with what they need."
    )
# else: customer_context block omitted entirely (D-11)
```

Verbiage mirrors `check_caller_history.py:107-117` — a battle-tested silent-awareness pattern.

### Pattern 3: `check_customer_account()` tool factory (D-09)

Modeled exactly on `check_caller_history.py`:

```python
from livekit.agents.llm import function_tool

def create_check_customer_account_tool(deps):
    @function_tool(
        name="check_customer_account",
        description=(
            "Returns the caller's Xero customer-account context as a STATE+DIRECTIVE block. "
            "Use ONLY when the caller explicitly asks about their balance, bill, recent work, "
            "or confirms they are an existing customer. Never call proactively. "
            "Returns no_xero_contact_for_phone when caller is unknown."
        ),
    )
    async def check_customer_account() -> str:
        ctx = getattr(deps, "customer_context", None) if not isinstance(deps, dict) else deps.get("customer_context")
        return format_customer_context_state(ctx)
    return check_customer_account
```

**The tool re-serves cached data — never re-fetches.** Per D-08, the data was loaded into `deps.customer_context` by `_run_db_queries` at call start. Mid-call re-fetch is out of scope (Claude's discretion → defer).

### Pattern 4: Refresh-aware token getter with write-back (Pitfall 5)

Inside `livekit-agent/src/integrations/xero.py`:
1. Read `accounting_credentials` row via `get_supabase_admin()` wrapped in `asyncio.to_thread`.
2. Check `expiry_date - now() > 5min` — if not, refresh.
3. Refresh via httpx POST to `https://identity.xero.com/connect/token` with `grant_type=refresh_token`.
4. **Persist new tokens back** (access_token + refresh_token + expiry_date together) — non-negotiable per Pitfall 5.
5. On refresh failure: persist `error_state='token_refresh_failed'`, return None. **Never send email from Python** — that's dashboard-only (Plan 05).

### Anti-Patterns to Avoid (Python side)

- **Calling `notifyXeroRefreshFailure` from Python.** Email is dashboard-only — repeated calls during a busy call period would spam owner inbox. Per Pitfall in CONTEXT `<known_pitfalls>` line 236-237.
- **Speakable English in `check_customer_account` return.** Triggers parrot loop. STATE+DIRECTIVE only.
- **Humanizing the prompt block.** "Make it readable" defeats the philosophy. The block is for Gemini, not humans.
- **Forgetting refresh-token write-back.** Causes Pitfall 5 race with Next.js side.
- **Putting raw phone in Sentry tags.** Use first 8 chars of sha256(phone) — `tenant_id` is a UUID (no PII) but phone is.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Xero OAuth flow | Custom OAuth 2 client | `xero-node` `XeroClient` | Already-shipped P54 code; handles `apiCallback`, `updateTenants`, scope-bundle quirks, `expires_at` vs `expires_in` shape variance |
| HMAC webhook signature verify | `crypto.createHash` + string `===` | `crypto.createHmac('sha256', key)` + `crypto.timingSafeEqual(Buffer, Buffer)` | Timing-attack resistance; matches Stripe webhook pattern in repo |
| Refresh-aware token getter | Per-call expiry check | `refreshTokenIfNeeded(supabase, cred)` from `src/lib/integrations/adapter.js:42` | P54 already implemented; handles serialization (you should still verify it serializes concurrent refreshes — see Pitfall 3) |
| Cache invalidation | Cache-key tracking + manual eviction | `'use cache'` + `cacheTag` + `revalidateTag` | Next.js 16 native; survives server restarts; tested in P54 status.js |
| Resend transactional email | Raw HTTP to Resend | `getResendClient()` from `src/lib/notifications.js` | Project-standard wrapper; tested by `billing_notifications` flow |
| React Email templates | HTML strings | `@react-email/components` (Body, Container, Head, Heading, Link, Preview, Section, Text) | Existing `src/emails/` precedent; renders identically across mail clients |
| OAuth state CSRF protection | New nonce table | `signOAuthState`/`verifyOAuthState` from P54 | Already HMAC-signed against `SUPABASE_SERVICE_ROLE_KEY`; reused across all integrations |
| Setup checklist row | New endpoint | Append to `/api/setup-checklist` `VALID_ITEM_IDS` + `ITEM_META` + parallel state query | Existing pattern; minimum-diff change |
| Webhook idempotency table | `xero_webhook_events` table | (Skip for P55 — RESOLVED Open Question 5) | `revalidateTag` is idempotent; webhook volume low; add in P58 if telemetry shows duplicate processing |
| Python Xero SDK setup | `xero-python` + typed models | Raw `httpx` (3 endpoints, 700ms per-request timeout) | Open Question 4 RESOLVED → tighter timeout control on 800ms hot path; smaller dep footprint |
| Phone E.164 normalization (Python) | Custom regex | Existing `_normalize_phone` in `livekit-agent/src/lib/phone.py` | Project-standard; Twilio `from_number` already E.164 |

**Key insight:** P54 did the heavy lifting on the integrations foundation. P55 is mostly **wiring** the existing primitives (`'use cache'` loop, refresh-aware token getter, OAuth state signing, Resend client) into new shapes. The only genuinely new code is `fetchCustomerByPhone`, the webhook handler, the Python `xero.py` module, the `check_customer_account` tool, and the `error_state` schema column.

---

## Common Pitfalls

### Pitfall 1: D-01 Phone filter syntax (CRITICAL)

**What goes wrong:** D-01 specifies `WHERE Phones.PhoneNumber=="${phoneE164}"`. This filter shape **does not work reliably** against Xero's Contacts API. The OData filter on `Phones[]` requires indexed access (e.g. `Phones[0].PhoneNumber`), and the `==` operator on raw phone strings has historical bugs around whitespace, plus signs, and country-code formatting variance in stored Xero contact data.

**Why it happens:** Xero stores up to 4 phone records per contact (DEFAULT, MOBILE, FAX, DDI), each with separate fields. The single-shot `Phones.PhoneNumber=="${phoneE164}"` filter at best queries only `Phones[0]` (DEFAULT) and at worst returns nothing at all.

**How to avoid:** Both Plans 02 (Next.js) and 06 (Python) implement the **adapted** approach:
1. **Candidate filter** via `Phones[0].PhoneNumber.Contains("<lastTen>")` where `lastTen` is the last 10 digits of the E.164 number (no plus, country code stripped to last 10).
2. **JS/Python post-filter** for E.164 exact equality across ALL phone slots:
   ```javascript
   const contact = candidates.find(c =>
     Array.isArray(c.phones) && c.phones.some(p => p.phoneNumber === phoneE164),
   );
   ```
3. **Validate E.164 BEFORE interpolation** — `^\+[1-9]\d{6,14}$` regex. Prevents OData injection AND cacheTag injection.
4. Recommend the planner runs a **manual one-shot test** against the Xero demo company with known contact phones before locking the fetcher implementation.

**Warning signs:** `outstandingBalance` shows `0` for a contact you KNOW has open invoices; `lastInvoices` is empty for a contact with recent activity. → check that the Contains hint matched the candidate set, then check the JS post-filter equality.

[ASSUMED — A6 — top research uncertainty. Manual demo-company test is the de-risk.]

### Pitfall 2: Webhook intent-to-receive handshake

**What goes wrong:** Xero subscribes a webhook URL by sending **4 probe POSTs** during registration. Three carry intentionally bad signatures and expect 401 responses; one carries a valid signature and expects 200. If any of these don't behave correctly, the webhook subscription fails with no clear error in the Xero developer portal.

**Why it happens:** Xero verifies that your handler "challenges" bad signatures (proves you're computing HMAC), not just "accepts" anything. A handler that returns 200 on bad sigs (or 500 on any sig) fails the handshake.

**How to avoid:**
- Read raw body via `await request.text()` BEFORE any JSON parse.
- Compute `crypto.createHmac('sha256', XERO_WEBHOOK_KEY).update(rawBody, 'utf8').digest('base64')`.
- Compare with `crypto.timingSafeEqual(Buffer.from(sigHeader, 'utf8'), Buffer.from(expected, 'utf8'))` after a length check (timingSafeEqual throws on length mismatch).
- Bad/missing sig → 401. Good sig → 200. Always 200 once sig is valid (even if downstream resolution fails — Xero retries on non-200).
- All 4 probes carry small payloads (NOT empty); the good probe's body IS HMAC-signed validly.

**Warning signs:** Webhook subscription stuck in "pending verification" in Xero portal; no events flowing despite invoice activity. → check Railway/Vercel logs for the handshake POSTs and confirm 3×401 + 1×200 pattern.

[CITED: Xero Webhooks documentation — webhook security overview]

### Pitfall 3: Token refresh race (cross-runtime)

**What goes wrong:** Both the Next.js side (dashboard read paths, webhook handler) and the Python side (livekit-agent on Railway) can refresh the same Xero access token. Without a serialization mechanism, two concurrent refresh attempts race; Xero's refresh-token rotation invalidates the older one, causing the "loser" to see `invalid_grant` and surface a fake refresh failure.

**Why it happens:** Xero rotates the refresh_token on every refresh. If Next.js refreshes first and writes back, then Python tries with the OLD refresh_token, Python's call fails. Same in reverse.

**How to avoid:**
- **Always write back ALL three columns together** (access_token + refresh_token + expiry_date) on every successful refresh, from BOTH sides. This is non-negotiable per Plan 06's `_persist_refreshed_tokens`.
- **Refresh on a wide buffer** (5 min before expiry — `REFRESH_BUFFER_SECONDS = 300`) so the window where both sides see "needs refresh" is narrow.
- **In a future iteration** (P58 if telemetry shows races), add a Postgres advisory lock keyed by `(tenant_id, 'xero_refresh')` around the refresh + write-back sequence. P55 accepts the small race window.
- Plan 02 (Next.js fetcher) catches refresh failure and silently degrades to `{ contact: null }` — avoids cascading the failure into the call path.

**Warning signs:** `error_state='token_refresh_failed'` set on a row that the owner believes is healthy; reconnect "magically" fixes it. → likely a transient race; if it recurs, add advisory locking.

### Pitfall 4: 800ms hot-path budget

**What goes wrong:** Pre-session injection (D-08) means the Xero fetch sits **in front of `session.start()`** — every millisecond Xero takes is added to greeting latency. A naive implementation that waits indefinitely on Xero will make the agent feel sluggish or, worse, time out the call setup.

**Why it happens:** Xero cold-start variance can hit 1-2 seconds; rate-limited responses can take 5-30 seconds.

**How to avoid:**
- **Hard timeout at TWO layers:**
  1. `asyncio.wait_for(fetch_xero_customer_by_phone(...), timeout=0.8)` in `_run_db_queries`.
  2. `httpx.AsyncClient(timeout=0.7)` inside `xero.py` — leaves 100ms headroom for the Python wrapping.
- On timeout: `customer_context = None`, prompt block omitted (D-11), Sentry-capture with `tenant_id` + `phone_hash` (sha256, first 8 chars).
- **NEVER** fall back to a slower path — silent skip is correct; cold-call behavior is acceptable.
- After P55 ships, **measure greeting latency on staging** before declaring done. If 800ms feels laggy, the alternate is the rejected D-08 option B (post-greeting `generate_reply` injection) — accept the hallucination window.

**Warning signs:** Owners report "the AI takes a beat before answering"; Sentry shows >5% of calls hitting `xero_context: skipped (timeout or error)`. → tune cache TTL up, or revisit refresh strategy.

### Pitfall 5: PII in logs / cache tags

**What goes wrong:** Phone numbers ARE PII. Putting raw E.164 in Sentry tags, log lines, or cross-tenant-visible cache structures creates a compliance liability AND a cross-tenant cache-leak risk.

**Why it happens:** It's tempting to log `from_number` for debugging or stick it in a cache tag for inspection.

**How to avoid:**
- **In Sentry tags:** `phone_hash = hashlib.sha256(phone.encode()).hexdigest()[:8]` (8 chars is enough to correlate same-phone events without recovering the original).
- **In logs:** Either redact (`+1555***4567`) or omit entirely.
- **In cache tags:** ALWAYS prefix with `${tenantId}` so the phone never appears as a tenant-agnostic key. The two-tier `xero-context-${tenantId}-${phoneE164}` structure satisfies this — invalidating tenant A's phone never touches tenant B's cache.
- **Validate E.164 strictly** (`^\+[1-9]\d{6,14}$`) before interpolation. Prevents an attacker who could influence the phone source (theoretically: a spoofed Twilio webhook) from injecting OData fragments into the Xero filter or cacheTag values.

**Warning signs:** Sentry breadcrumbs leak full phone numbers in user-visible event details; cache tag dump (debugger inspection) shows raw phones outside tenant scope.

### Pitfall 6: Phase 54 inherits auto-flip on `tenants.features_enabled.invoicing=true` at OAuth callback

**What goes wrong:** P54's callback at `src/app/api/integrations/[provider]/callback/route.js:71-86` automatically sets `tenants.features_enabled.invoicing = true` on ANY successful integration connect. P55 inherits this. An owner who clicks "Connect Xero" expecting only caller-context will ALSO have invoicing turned on — unless the confirm-connect dialog has already warned them.

**Why it happens:** P54 designed this to avoid the chicken-and-egg where Xero is connected but produces no user-visible effect because the invoicing flag is still off.

**How to avoid:**
- **Keep the auto-flip** — Open Question 2 RESOLVED → keep. The existing confirm-connect AlertDialog in `BusinessIntegrationsClient.jsx:282-291` warns the owner explicitly with copy: _"Connecting Xero enables invoice sync, so invoicing will be turned on in your dashboard..."_
- Plan 03 explicitly preserves the auto-flip block. **Do not remove it** — Phase 56 Jobber expects the same invariant.
- Document the inheritance in the dashboard skill so future agents don't "fix" it.

**Warning signs:** Owners surprised that Invoices appears in their nav after connecting Xero. → confirm dialog was bypassed (CSP issue?) or copy was muted.

[VERIFIED: src/app/api/integrations/[provider]/callback/route.js:71-86]

### Pitfall 7: `error_state` column choice

**What goes wrong:** D-14 needs to persist refresh-failure state on the credentials row so the dashboard can surface a banner. Multiple plausible shapes exist (dedicated TEXT column, JSONB flag, separate table) and the wrong choice complicates queries or breaks RLS.

**How to avoid:** Open Question 3 RESOLVED → **dedicated `error_state TEXT NULL` column** via new migration `053_xero_error_state.sql` (Plan 01).
- Simplest queryable shape: `WHERE error_state IS NOT NULL` for the dashboard cron / status reads.
- Easy to clear: `UPDATE … SET error_state = NULL` on successful refresh OR successful re-OAuth.
- Partial index `idx_accounting_credentials_error_state ON (tenant_id, provider) WHERE error_state IS NOT NULL` keeps the table cheap for the common (healthy) case.
- Existing RLS on `accounting_credentials` covers the new column — no policy change needed.

**Warning signs:** Plan 01 shipped JSONB instead of dedicated column → Plan 05 has to write `jsonb_set(...)` instead of plain SET → painful refactor. Avoid by following Plan 01 verbatim.

---

## Runtime State Inventory

> P55 is mostly net-new code — no rename/refactor. Most categories are "None — verified by X." But two categories DO matter:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `accounting_credentials` table — Xero rows from P54-shipped OAuth (currently 501 in Plans 02/03 wires); existing rows (if any in dev) need `error_state` column populated NULL on first read | Migration 053 adds the column with default NULL; no data migration needed. |
| **Live service config** | Xero webhook subscription must be created in Xero Developer Portal pointing at `https://{app-domain}/api/webhooks/xero` AFTER `XERO_WEBHOOK_KEY` env var is registered. This is a manual user step. | Plan 01 documents in `user_setup`; Plan 04 ships the handler; user does the dev-portal subscription as a release-time step. |
| **OS-registered state** | None — no Windows tasks, pm2 process names, launchd plists, systemd units touched by P55 | None — verified by absence of process-management touchpoints in Plans 01-08. |
| **Secrets and env vars** | NEW: `XERO_WEBHOOK_KEY` (Xero assigns at app-level when webhook URL is subscribed). REUSED: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` (P54). Python livekit-agent reads `XERO_CLIENT_ID` + `XERO_CLIENT_SECRET` for token refresh — **must be set on Railway service** with the SAME values as Vercel. | Plan 01 documents `XERO_WEBHOOK_KEY` in `.env.example`. Plan 06 Task 4 includes Railway env var update. **Real values set out-of-band by user.** |
| **Build artifacts / installed packages** | Python livekit-agent may need `httpx>=0.27` added to `pyproject.toml` if not transitive. Re-run `pip install -r requirements.txt` (or `poetry install`) after pyproject change. | Plan 06 Task 4 includes verification step. |

**The canonical question:** *After every file in this monorepo is updated, what runtime systems still have the old/missing config?*
- Xero Developer Portal (webhook subscription) — manual.
- Railway env vars on livekit-agent service — manual.
- Vercel env vars (XERO_WEBHOOK_KEY) — manual.

---

## Code Examples

Verified patterns from in-repo P54 code + Stripe webhook precedent.

### Example 1: `XeroAdapter.fetchCustomerByPhone` (Next.js side, Plan 02)

```javascript
// src/lib/integrations/xero.js
async fetchCustomerByPhone(tenantId, phoneE164) {
  'use cache';
  cacheTag(`xero-context-${tenantId}`);
  cacheTag(`xero-context-${tenantId}-${phoneE164}`);

  if (typeof tenantId !== 'string' || typeof phoneE164 !== 'string') return { contact: null };
  if (!/^\+[1-9]\d{6,14}$/.test(phoneE164)) return { contact: null };

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'xero')
    .maybeSingle();
  if (!cred) return { contact: null };

  let refreshed;
  try { refreshed = await refreshTokenIfNeeded(admin, cred); }
  catch { return { contact: null }; }    // Plan 03/05 owns error_state write
  this.setCredentials(refreshed);
  const xeroOrgId = refreshed.xero_tenant_id;
  if (!xeroOrgId) return { contact: null };

  // Pitfall 1: Contains-based candidate + JS post-filter for E.164 equality
  const lastTen = phoneE164.replace(/\D/g, '').slice(-10);
  const contactsResp = await this._xeroClient.accountingApi.getContacts(
    xeroOrgId, undefined, `Phones[0].PhoneNumber.Contains("${lastTen}")`,
  );
  const contact = (contactsResp.body?.contacts || []).find(c =>
    (c.phones || []).some(p => p.phoneNumber === phoneE164),
  );
  if (!contact) return { contact: null };

  // outstandingBalance — AUTHORISED + AmountDue>0
  const outstandingResp = await this._xeroClient.accountingApi.getInvoices(
    xeroOrgId, undefined,
    `Status=="AUTHORISED" AND Contact.ContactID==guid("${contact.contactID}") AND AmountDue>0`,
  );
  const outstandingBalance = (outstandingResp.body?.invoices || [])
    .reduce((s, inv) => s + (Number(inv.amountDue) || 0), 0);

  // lastInvoices — AUTHORISED + PAID, Date DESC
  const recentResp = await this._xeroClient.accountingApi.getInvoices(
    xeroOrgId, undefined,
    `(Status=="AUTHORISED" OR Status=="PAID") AND Contact.ContactID==guid("${contact.contactID}")`,
    'Date DESC', undefined, 1,
  );
  const allRecent = recentResp.body?.invoices || [];
  const lastInvoices = allRecent.slice(0, 3).map(inv => ({
    invoiceNumber: inv.invoiceNumber, date: inv.date, total: inv.total,
    amountDue: inv.amountDue, status: inv.status, reference: inv.reference,
  }));

  const paidDates = allRecent.filter(i => i.status === 'PAID' && i.fullyPaidOnDate)
    .map(i => i.fullyPaidOnDate);
  const lastPaymentDate = paidDates.length > 0 ? paidDates.sort().at(-1) : null;

  // Telemetry seed (D-15 — per-fetch cadence; cheap write)
  await admin.from('accounting_credentials')
    .update({ last_context_fetch_at: new Date().toISOString() })
    .eq('id', cred.id);

  return { contact, outstandingBalance, lastInvoices, lastPaymentDate };
}
```

[Source: Plan 02 + verified against P54 status.js cache pattern]

### Example 2: Webhook handler (Next.js, Plan 04)

```javascript
// src/app/api/webhooks/xero/route.js
import crypto from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getIntegrationAdapter, refreshTokenIfNeeded } from '@/lib/integrations/adapter';

export const runtime = 'nodejs';      // crypto.timingSafeEqual requires Node runtime
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const rawBody = await request.text();
  const sig = request.headers.get('x-xero-signature');

  if (!sig || !process.env.XERO_WEBHOOK_KEY) {
    return new Response('', { status: 401 });
  }

  const expected = crypto.createHmac('sha256', process.env.XERO_WEBHOOK_KEY)
    .update(rawBody, 'utf8').digest('base64');

  let valid = false;
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { valid = false; }
  if (!valid) return new Response('', { status: 401 });

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return new Response('', { status: 200 }); }

  const events = Array.isArray(payload?.events) ? payload.events : [];
  if (events.length === 0) return new Response('', { status: 200 });   // intent-verify probe 4

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  for (const event of events) {
    const xeroOrgId = event?.tenantId;        // Pitfall 3: Xero org, NOT Voco tenant
    if (!xeroOrgId) continue;

    const { data: cred } = await admin
      .from('accounting_credentials').select('*')
      .eq('provider', 'xero').eq('xero_tenant_id', xeroOrgId).maybeSingle();
    if (!cred) continue;                       // D-07 silent-ignore unknown tenant

    const vocoTenantId = cred.tenant_id;
    let phones = [];

    if (event?.eventCategory === 'INVOICE' && event?.resourceId) {
      try {
        const adapter = await getIntegrationAdapter('xero');
        const refreshed = await refreshTokenIfNeeded(admin, cred);
        adapter.setCredentials(refreshed);
        const invResp = await adapter._xeroClient.accountingApi.getInvoices(
          xeroOrgId, undefined, undefined, undefined, [event.resourceId],
        );
        const contactID = invResp.body?.invoices?.[0]?.contact?.contactID;
        if (contactID) {
          const contactsResp = await adapter._xeroClient.accountingApi.getContacts(
            xeroOrgId, undefined, undefined, undefined, [contactID],
          );
          phones = (contactsResp.body?.contacts?.[0]?.phones || [])
            .map(p => (p?.phoneNumber || '').trim()).filter(Boolean);
        }
      } catch { phones = []; }   // D-06 broad-tag fallback
    }

    if (phones.length === 0) {
      revalidateTag(`xero-context-${vocoTenantId}`);
    } else {
      for (const p of phones) revalidateTag(`xero-context-${vocoTenantId}-${p}`);
    }
  }

  return new Response('', { status: 200 });
}
```

[Source: Plan 04 + Stripe webhook pattern at src/app/api/stripe/webhook/route.js]

### Example 3: Python `fetch_xero_customer_by_phone` (cross-repo, Plan 06)

```python
# livekit-agent/src/integrations/xero.py
import asyncio, logging, os, re, time
from typing import Optional
import httpx

XERO_API_BASE = "https://api.xero.com/api.xro/2.0"
XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
HTTP_TIMEOUT_SECONDS = 0.7         # 100ms headroom under the 800ms agent budget
REFRESH_BUFFER_SECONDS = 300       # refresh if expires < 5min
E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")

async def fetch_xero_customer_by_phone(tenant_id: str, phone_e164: str) -> Optional[dict]:
    if not isinstance(tenant_id, str) or not isinstance(phone_e164, str): return None
    if not E164_RE.match(phone_e164): return None

    cred = await _load_credentials(tenant_id)
    if not cred or not cred.get("xero_tenant_id"): return None

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        cred = await _refresh_if_needed(client, cred)   # write-back + error_state on fail
        if not cred: return None

        contact = await _get_contacts_by_phone(client, cred, phone_e164)   # Contains + JS post-filter
        if not contact: return None

        contact_id = contact.get("ContactID")
        outstanding_balance = await _get_outstanding_balance(client, cred, contact_id)
        all_recent = await _get_recent_invoices(client, cred, contact_id)

        last_invoices = [
            {"invoice_number": i.get("InvoiceNumber"), "date": i.get("Date"),
             "total": i.get("Total"), "amount_due": i.get("AmountDue"),
             "status": i.get("Status"), "reference": i.get("Reference")}
            for i in all_recent[:3]
        ]
        paid_dates = [i.get("FullyPaidOnDate") for i in all_recent
                      if i.get("Status") == "PAID" and i.get("FullyPaidOnDate")]
        last_payment_date = max(paid_dates) if paid_dates else None

    await _touch_last_context_fetch_at(cred["id"])

    return {
        "contact": {"contact_id": contact.get("ContactID"), "name": contact.get("Name"),
                    "phones": [p.get("PhoneNumber") for p in (contact.get("Phones") or [])]},
        "outstanding_balance": outstanding_balance,
        "last_invoices": last_invoices,
        "last_payment_date": last_payment_date,
    }
```

[Source: Plan 06 — full module ~280 LoC including refresh logic + write-back]

### Example 4: 4th parallel task in `_run_db_queries` (cross-repo, Plan 06)

```python
# livekit-agent/src/agent.py — modification inside _run_db_queries
xero_context_task = asyncio.create_task(
    asyncio.wait_for(
        fetch_xero_customer_by_phone(deps.tenant_id, from_number),
        timeout=0.8,
    )
)

results = await asyncio.gather(
    sub_task, intake_task, call_task, xero_context_task,
    return_exceptions=True,
)

xero_result = results[3]
customer_context = None
if isinstance(xero_result, (asyncio.TimeoutError, Exception)):
    if SENTRY_AVAILABLE:
        try:
            sentry_sdk.capture_exception(xero_result, tags={
                "tenant_id": deps.tenant_id,
                "phone_hash": hashlib.sha256(from_number.encode()).hexdigest()[:8],
                "phase": "55", "component": "xero_context_fetch",
            })
        except Exception: pass    # never let telemetry crash the call path
elif xero_result is not None:
    customer_context = xero_result

return {
    'subscription': ..., 'intake': ..., 'call_record': ...,
    'customer_context': customer_context,   # P55
}
```

### Example 5: `format_customer_context_state` shared formatter (cross-repo, Plan 07)

```python
# livekit-agent/src/tools/check_customer_account.py
def format_customer_context_state(ctx: Optional[dict]) -> str:
    if not ctx or not ctx.get("contact"):
        return ("STATE: no_xero_contact_for_phone.\n"
                "DIRECTIVE: Treat as new or walk-in customer. "
                "Do not claim to have any records on file.")

    contact = ctx["contact"]
    outstanding = float(ctx.get("outstanding_balance") or 0)
    invoices = ctx.get("last_invoices") or []
    last_payment = ctx.get("last_payment_date")

    state_parts = [f"contact={contact.get('name', 'unknown')}"]
    if outstanding > 0:
        n_due = sum(1 for i in invoices
                    if i.get("status") == "AUTHORISED" and (i.get("amount_due") or 0) > 0)
        state_parts.append(f"outstanding=${outstanding:.2f} across {n_due} invoices")
    else:
        state_parts.append("outstanding=$0")

    if invoices:
        last = invoices[0]
        state_parts.append(
            f"last_invoice={last.get('invoice_number')} ${last.get('total')} "
            f"dated {last.get('date')} ({(last.get('status') or '').lower()})"
        )
    if last_payment:
        state_parts.append(f"last_payment={last_payment}")

    return (f"STATE: {'; '.join(state_parts)}.\n"
            "DIRECTIVE: Answer factually only if the caller explicitly asks about their balance, "
            "bill, or recent work. Do not read invoice numbers unless asked. Do not volunteer figures. "
            "If the caller asks 'do you have my info?' confirm presence without specifics "
            "(we have your contact on file). NEVER claim to have verified or confirmed anything you "
            "have not been asked about. NEVER mention outstanding balance unprompted.")
```

This formatter is used in TWO places (DRY): the `check_customer_account()` tool return, AND the `prompt.py` `customer_context` block injection.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Xero broad-access scope | Granular scopes (`accounting.invoices`, `accounting.contacts`, `accounting.transactions.read`, etc.) | 2026-03-02 (Xero deprecation) | P54 already migrated [VERIFIED: src/lib/integrations/xero.js:11-16] |
| Implicit Next.js caching | Explicit `'use cache'` + `cacheTag` + `revalidateTag` | Next.js 16 | P54 proved the loop; P55 reuses pattern [CITED: nextjs-16-complete-guide skill] |
| middleware.ts | proxy.ts | Next.js 16 | Project-wide change, not P55-specific |
| `getInvoices(contactId, statuses=[...])` array params | `getInvoices(where='OData filter string')` | Long-standing Xero-node behavior | Array-param overload returns ALL invoices (bug); use `where` strings [CITED: xero-node GitHub issue #339] |

**Deprecated/outdated:**
- `accounting.settings` scope: NOT requested by P54's adapter; we explicitly skip the `getOrganisations` call by passing `false` to `updateTenants(false)`. Don't add this scope unless we need org metadata. [VERIFIED: src/lib/integrations/xero.js:67-69]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Next.js side) | Vitest (project-standard for new tests; Jest fallback acceptable) |
| Framework (Python side) | pytest + pytest-asyncio (livekit-agent existing convention) |
| Config file (Next.js) | `vitest.config.*` if present; otherwise default vitest config |
| Config file (Python) | `livekit-agent/pytest.ini` or `pyproject.toml [tool.pytest.ini_options]` |
| Quick run command (Next.js) | `npx vitest run tests/<scope>` |
| Quick run command (Python, cross-repo) | `cd C:/Users/leheh/.Projects/livekit-agent && pytest tests/<file> -v` |
| Full suite command (Next.js) | `npm test` |
| Full suite command (Python, cross-repo) | `cd C:/Users/leheh/.Projects/livekit-agent && pytest -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **XERO-01** | OAuth round-trip persists row + clears error_state + revalidates xero-context tag | unit (route) | `npx vitest run tests/api/integrations/oauth.test.js` | ❌ Wave 0 (Plan 03 Task 1) |
| **XERO-01** | Disconnect revokes at Xero + deletes row + revalidates tags | unit (route) | `npx vitest run tests/api/integrations/disconnect.test.js` | ❌ Wave 0 (Plan 03 Task 1) |
| **XERO-01** | `connect_xero` checklist auto-completes via row presence | unit (route) | `npx vitest run tests/api/setup-checklist.test.js` | ❌ Wave 0 (Plan 05 Task 1) |
| **XERO-01** | `notifyXeroRefreshFailure` writes error_state + sends Resend email | unit (lib) | `npx vitest run tests/lib/notifyXeroRefreshFailure.test.js` | ❌ Wave 0 (Plan 05 Task 1) |
| **XERO-01** | Card renders 4 states (Disconnected / Connected w/timestamp / Reconnect-needed / Loading) | unit (snapshot/RTL) | `npx vitest run tests/components/BusinessIntegrationsClient.test.jsx` | ❌ Wave 0 (Plan 05 Task 1) |
| **XERO-02** | `fetchCustomerByPhone` shape: contact, outstandingBalance, lastInvoices, lastPaymentDate | unit | `npx vitest run tests/integrations/xero.fetch.test.js` | ❌ Wave 0 (Plan 02 Task 1) |
| **XERO-02** | `fetchCustomerByPhone` returns `{ contact: null }` on no creds / no match | unit | (same file) | ❌ Wave 0 |
| **XERO-02** | `'use cache'` is FIRST statement + two-tier cacheTag present | static-grep | `npx vitest run tests/integrations/xero.cache.test.js` | ❌ Wave 0 (Plan 02 Task 1) |
| **XERO-03** | Webhook 401 on bad/missing sig (intent-verify probes 1-3) | unit (route) | `npx vitest run tests/api/webhooks/xero.test.js` | ❌ Wave 0 (Plan 04 Task 1) |
| **XERO-03** | Webhook 200 on valid sig with empty events (probe 4) | unit (route) | (same file) | ❌ Wave 0 |
| **XERO-03** | Webhook → per-phone revalidateTag on resolved INVOICE event | unit (route) | (same file) | ❌ Wave 0 |
| **XERO-03** | Webhook → broad-tag fallback on resolution failure | unit (route) | (same file) | ❌ Wave 0 |
| **XERO-03** | Webhook silent-200 on unknown Xero tenant | unit (route) | (same file) | ❌ Wave 0 |
| **XERO-04** | Python `fetch_xero_customer_by_phone` returns full shape on match | unit (cross-repo) | `pytest livekit-agent/tests/test_xero_integration.py -v` | ❌ Wave 0 (Plan 06 Task 3) |
| **XERO-04** | Python refresh persists access_token + refresh_token + expiry_date together (Pitfall 5) | unit (cross-repo) | (same file) | ❌ Wave 0 |
| **XERO-04** | Python refresh failure writes error_state='token_refresh_failed' AND returns None | unit (cross-repo) | (same file) | ❌ Wave 0 |
| **XERO-04** | `_run_db_queries` 800ms timeout sets customer_context=None | unit (cross-repo) | `pytest livekit-agent/tests/test_agent_xero_timeout.py -v` | ❌ Wave 0 (Plan 06 Task 3) |
| **XERO-04** | `format_customer_context_state(None)` returns locked no-match string | unit (cross-repo) | `pytest livekit-agent/tests/test_check_customer_account.py -v` | ❌ Wave 0 (Plan 07 Task 3) |
| **XERO-04** | `build_system_prompt(customer_context=ctx)` injects block AFTER anti-hallucination | unit (cross-repo) | `pytest livekit-agent/tests/test_prompt_customer_context.py -v` | ❌ Wave 0 (Plan 07 Task 3) |
| **XERO-04** | UAT scenarios A (caller IN Xero), B (NOT in), C (Xero disconnected) — silent-awareness verified | manual | Plan 07 Task 4 checklist | ❌ Manual gate |

### Sampling Rate

- **Per task commit:** Run only the tests modified by that task's `<files>` list (e.g. `npx vitest run tests/integrations/xero.fetch.test.js` after Plan 02 Task 2).
- **Per wave merge:** Run all tests in the wave's scope. Wave 1 (Plans 01, 02, 06): `npx vitest run tests/integrations tests/lib && pytest livekit-agent/tests/test_xero_integration.py -v`. Wave 2 (Plans 03, 04, 05, 07): everything else.
- **Phase gate:** Full suite green on BOTH repos before `/gsd-verify-work`. Manual UAT scenarios A/B/C from Plan 07 Task 4 + the visual UAT from Plan 05 Task 4 must both pass.

### Wave 0 Gaps

All 11 test files are NEW for P55. None of them exist yet — they are scaffolded in each plan's Task 1.

- [ ] `tests/integrations/xero.fetch.test.js` — Plan 02 Wave 0
- [ ] `tests/integrations/xero.cache.test.js` — Plan 02 Wave 0
- [ ] `tests/api/integrations/oauth.test.js` — Plan 03 Wave 0
- [ ] `tests/api/integrations/disconnect.test.js` — Plan 03 Wave 0
- [ ] `tests/api/webhooks/xero.test.js` — Plan 04 Wave 0
- [ ] `tests/fixtures/xero-webhook-payloads/{intent-verify-good,intent-verify-bad,invoice-event}.json` — Plan 04 Wave 0
- [ ] `tests/api/setup-checklist.test.js` — Plan 05 Wave 0
- [ ] `tests/lib/notifyXeroRefreshFailure.test.js` — Plan 05 Wave 0
- [ ] `tests/components/BusinessIntegrationsClient.test.jsx` — Plan 05 Wave 0
- [ ] `livekit-agent/tests/test_xero_integration.py` — Plan 06 Wave 0 (cross-repo)
- [ ] `livekit-agent/tests/test_agent_xero_timeout.py` — Plan 06 Wave 0 (cross-repo)
- [ ] `livekit-agent/tests/test_check_customer_account.py` — Plan 07 Wave 0 (cross-repo)
- [ ] `livekit-agent/tests/test_prompt_customer_context.py` — Plan 07 Wave 0 (cross-repo)

Framework install: confirm vitest is installed in this repo (likely yes — check `package.json devDependencies`); confirm pytest + pytest-asyncio are installed in livekit-agent (likely yes from existing `tests/` directory).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | OAuth 2.0 (xero-node SDK); HMAC-signed OAuth state for CSRF (P54 `signOAuthState`/`verifyOAuthState` reused) |
| V3 Session Management | yes | Supabase Auth (project-standard); `getTenantId()` from authenticated session for all owner-facing routes |
| V4 Access Control | yes | Service-role Supabase reads of `accounting_credentials` are scoped via `.eq('tenant_id', tenantId)` from authenticated session; Python side resolves `tenant_id` server-side from call DB lookup, never from a tool argument |
| V5 Input Validation | yes | E.164 strict regex `^\+[1-9]\d{6,14}$` before any interpolation into Xero `where` filter or cacheTag value; webhook payload parsed only AFTER signature verify |
| V6 Cryptography | yes | `crypto.createHmac('sha256', key)` + `crypto.timingSafeEqual` (Node) for webhook; `hashlib.sha256` (Python) for Sentry phone-tag hashing — never hand-roll HMAC |
| V7 Error Handling | yes | All `catch` blocks log only `err.message`; never log `cred`, `sig`, full `err.response`, or env var values |
| V8 Data Protection | yes | Phone numbers (PII) hashed in Sentry tags; raw refresh_tokens never appear in logs or email bodies; `accounting_credentials.access_token` + `refresh_token` are RLS-protected |
| V9 Communications | yes | All Xero API calls outbound HTTPS; webhook from Xero verified by HMAC (no IP allowlist needed) |
| V10 Malicious Code | n/a | No dynamic code execution; no eval; no untrusted templates |
| V11 Business Logic | yes | D-07 silent-200 on unknown tenant prevents Xero retry storms; 800ms timeout caps DoS surface from slow Xero responses |
| V13 API & Web Service | yes | Webhook endpoint requires HMAC signature; OAuth state requires HMAC-signed state; integration adapter pattern centralizes auth |
| V14 Configuration | yes | `XERO_WEBHOOK_KEY`, `XERO_CLIENT_SECRET` in env vars only (`.env.example` has placeholders); never committed |

### Known Threat Patterns for Next.js + Python integration stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OAuth callback CSRF | Spoofing | HMAC-signed state via P54's `signOAuthState`/`verifyOAuthState`; bad state → 400 (Plan 03) |
| Webhook signature forgery | Spoofing | HMAC-SHA256 over raw body + `crypto.timingSafeEqual`; bad sig → 401 (Plan 04) |
| Timing attack on signature compare | Information Disclosure | `timingSafeEqual` with length check before; never `===` (Plan 04) |
| OData injection via phone in `where` filter | Tampering | E.164 strict regex BEFORE interpolation; `lastTen` is digits-only via `.replace(/\D/g, '')`; `contactID` is opaque GUID from Xero (not user input) (Plans 02, 04, 06) |
| Cross-tenant cache leak via cacheTag | Information Disclosure | All cache tags include `${tenantId}` prefix; tenant-scope every tag (Plans 02, 03, 04) |
| Token leak in logs | Information Disclosure | `catch` blocks log only `err.message`; never `cred`, `err.response.body`, `process.env.*` (all plans) |
| Stale-token cross-runtime race | Tampering / Repudiation | Both Next.js and Python write back access_token + refresh_token + expiry_date together on every refresh (Pitfall 5; Plan 06) |
| Cached error result poisoning | DoS | `fetchCustomerByPhone` never throws; on failure returns `{ contact: null }` (a valid cache value); 5-min TTL self-heals (Plan 02) |
| Notification storm from refresh failures | DoS | `notifyOnFailure` default `false` on `refreshTokenIfNeeded`; only dashboard read paths opt in; Python NEVER triggers email (Plan 05; Pitfall in CONTEXT) |
| Email phishing exploiting refresh-failure cadence | Spoofing | Email FROM `noreply@voco.live` with SPF/DKIM via Resend; no clickable secret tokens; CTA points at authenticated dashboard URL (Plan 05) |
| Agent volunteers customer balance unprompted | Information Disclosure | STATE+DIRECTIVE prompt shape + CRITICAL RULE prohibitions; verbiage mirrors `check_caller_history.py:107-117`; UAT scenario A explicitly verifies (Plan 07) |
| Caller social-engineers tool to disclose | Spoofing | DIRECTIVE limits agent to factual answers only when explicitly asked; "do you have my info?" → "we have your contact on file" without specifics (Plan 07) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `xero-node` (npm) | Next.js side fetcher + OAuth + revoke | ✓ (P54) | ^9.x | — |
| Next.js 16 `'use cache'` runtime | Next.js side cache primitive | ✓ (P54 enabled `cacheComponents: true`) | 16.x | — |
| Supabase (live) | Migration 053 push | ✓ | n/a | If push fails, manual SQL via Supabase Studio (Plan 01 Task 3) |
| `crypto` (Node stdlib) | Webhook HMAC | ✓ (built-in) | n/a | — |
| Resend API | D-14 email | ✓ (existing helper) | n/a | If RESEND_API_KEY missing, `notifyXeroRefreshFailure` writes error_state but skips email (Plan 05) |
| `httpx` (Python, cross-repo) | livekit-agent Xero fetch | ⚠️ verify | ^0.27 | Add to `pyproject.toml` if missing (Plan 06 Task 4) |
| `sentry_sdk` (Python, cross-repo) | 800ms timeout capture | ⚠️ assumed available | n/a | If absent, telemetry skipped silently (try/except wrap in Plan 06) |
| Xero Developer Portal access | OAuth app + webhook subscription | ⚠️ external user action | n/a | Blocks execution (NOT planning) — STATE.md tracks |
| Xero demo company | UAT testing | ⚠️ user provisions | n/a | Blocks UAT scenarios in Plans 05/07 |
| Railway deploy access (livekit-agent) | Plan 06 Task 4 commit + push | ⚠️ user action | n/a | — |

**Missing dependencies with no fallback:** Xero Developer Portal access (external manual action, blocks XERO-03 webhook subscription).

**Missing dependencies with fallback:** `httpx` (auto-add via pyproject change), `sentry_sdk` (silent skip via try/except).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Python livekit-agent uses `httpx` already as a transitive dep | Standard Stack (Python) | Low — if not, plan adds it; trivial install |
| A2 | `revalidateTag(tag)` single-arg works in Voco's Next.js 16 install (P54 evidence) | Pitfall 4 | Low — P54 disconnect/callback already use this in production |
| A3 | Recommend "voice" theme for `connect_xero` checklist item | Pattern 4 | Low — purely UX call; planner can override |
| A4 | Auto-flip `invoicing=true` on Xero connect (P54 inheritance) is intentional + acceptable per CONTEXT | Pitfall 6 | Medium — if intent was to decouple, this is a behavior bug. Flag for confirmation. |
| A5 | Sentry SDK is configured in livekit-agent (D-04 references it) | Example 4 | Low — Sentry is referenced throughout CONTEXT; assumed live |
| A6 | Xero phone filter requires per-index queries OR post-filter (D-01's `Phones.PhoneNumber=="..."` syntax not supported) | Pitfall 1 | **HIGH — top research uncertainty.** Recommend planner runs a one-shot test before locking fetcher impl. |
| A7 | Resend email tone matches existing `billing_notifications` voice | Standard Stack | Low — purely copywriting |
| A8 | `xero-python` SDK exists and has comparable ergonomics | Standard Stack (Python) | Low — well-documented official package on PyPI |

---

## Open Questions (RESOLVED)

1. **Xero phone filter syntax (CRITICAL):** D-01 says `WHERE Phones.PhoneNumber=="${phoneE164}"`. Documentation suggests this requires `Phones[0].PhoneNumber.Contains("...")` with index. Each contact has up to 4 phone entries (DEFAULT, MOBILE, FAX, DDI).
   - **What we know:** OData filter requires indexed access; `Contains()` works reliably; `==` on phone strings has historical bugs.
   - **What's unclear:** Whether D-01's intent is "exact match exact phone" or "contains last-N digits". CONTEXT clearly says exact match.
   - **RESOLVED — Recommendation:** Planner runs a manual test against the Xero demo company with known contact phones BEFORE locking the fetcher. Implementation fallback: post-filter all matches in JS for exact E.164 equality. Adopted in Plans 02 (Next.js fetchCustomerByPhone) + 06 (Python fetch_xero_customer_by_phone) — both use Contains() candidate filter then JS post-filter for E.164 exact equality.

2. **Invoicing flag auto-flip on Xero connect (P54 inheritance):**
   - **What we know:** P54's callback at `src/app/api/integrations/[provider]/callback/route.js:71-86` auto-flips `tenants.features_enabled.invoicing = true` on any integration connect. P55 CONTEXT.md is read-side only.
   - **What's unclear:** Whether to decouple this for read-only callers.
   - **RESOLVED — Recommendation:** Keep auto-flip; the existing confirm-connect dialog in `BusinessIntegrationsClient.jsx:282-291` warns the user. Or remove the auto-flip — flag for planner. Adopted in Plan 03 — the OAuth callback explicitly preserves the P54 auto-flip behavior.

3. **`error_state` schema choice:**
   - **What we know:** D-claudes-discretion. Options: dedicated `TEXT NULL` column on `accounting_credentials`, or JSONB flag, or separate table.
   - **RESOLVED — Recommendation:** Dedicated `error_state TEXT NULL` column via new `053_xero_error_state.sql`. Simplest, queryable, easy to clear (UPDATE … SET error_state = NULL on successful refresh). JSONB adds query complexity for one field. Adopted in Plan 01 — migration `053_xero_error_state.sql` creates the dedicated TEXT NULL column with a partial index.

4. **Python SDK choice:**
   - **What we know:** `xero-python` (typed) vs. raw `httpx`. Discretion area.
   - **RESOLVED — Recommendation:** Raw `httpx` — keeps Python deps lean, gives explicit timeout control on the 800ms-budget hot path, and the surface is small (3 endpoints: token refresh, getContacts, getInvoices). The Python integration module is ~150 LoC either way. Adopted in Plan 06 — `livekit-agent/src/integrations/xero.py` uses raw httpx with 700ms per-request timeout.

5. **Webhook idempotency:**
   - **What we know:** Discretion — dedicated `xero_webhook_events` table vs. trust Xero + `revalidateTag` idempotency.
   - **RESOLVED — Recommendation:** Skip the dedicated table for P55. `revalidateTag` is idempotent; webhook event volume is low; the extra Xero round-trip is the cost we'd dedup against, but Xero replays are rare. Add the table in P58 if telemetry shows duplicate processing. Adopted in Plan 04 — no idempotency table; deferred to P58 pending telemetry.

6. **Theme for `connect_xero` checklist item:**
   - **What we know:** Existing themes are profile/voice/calendar/billing.
   - **RESOLVED — Recommendation:** `voice` (Xero feeds the AI receptionist with caller context). Defensible: `billing`. Planner picks. Adopted in Plan 05 — `connect_xero` checklist item uses `voice` theme.

---

## Sources

### Primary (HIGH confidence)
- **In-repo verified code:**
  - `src/lib/integrations/xero.js` — P54 XeroAdapter base (XeroClient init, OAuth, refresh, revoke, push) [VERIFIED]
  - `src/lib/integrations/adapter.js:42` — `refreshTokenIfNeeded(supabase, credentials)` signature [VERIFIED via grep]
  - `src/lib/integrations/status.js` — `'use cache'` + cacheTag template [VERIFIED via P54 reference]
  - `src/app/api/integrations/[provider]/callback/route.js:71-86` — invoicing auto-flip block [VERIFIED]
  - `src/app/api/stripe/webhook/route.js` — raw-body + signature verify pattern [VERIFIED via project skill]
  - `supabase/migrations/052_integrations_schema.sql` — P54 schema with `scopes TEXT[]`, `last_context_fetch_at TIMESTAMPTZ` [VERIFIED via file listing]
  - `src/components/dashboard/BusinessIntegrationsClient.jsx` — single-client card; PROVIDER_META map; AlertDialog flows [CITED via UI-SPEC + CONTEXT]
- **Project skills (LOCAL DOCUMENTATION):**
  - `voice-call-architecture` — `_run_db_queries`, `VocoAgent`, deps dict, post-call pipeline
  - `auth-database-multitenancy` — `accounting_credentials` schema, RLS policies, service-role pattern, `getTenantId()`
  - `dashboard-crm-system` — `/dashboard/more/*` conventions, AlertDialog usage, banner treatments
  - `payment-architecture` — webhook handler pattern (Stripe precedent: idempotency, signature verify, raw-body)
  - `nextjs-16-complete-guide` — `'use cache'` directive placement, cacheTag, revalidateTag, cacheLife
  - `onboarding-flow` — `/api/setup-checklist` response shape + completion-detection
- **User-pinned reference:**
  - `memory/feedback_livekit_prompt_philosophy.md` — STATE+DIRECTIVE shape, anti-hallucination, persona preservation, SDK pin (`livekit-agents==1.5.1` + `livekit-plugins-google@43d3734`)

### Secondary (MEDIUM-HIGH confidence)
- **Xero Developer Documentation** [CITED]:
  - Xero OAuth 2.0 + scope reference (granular scopes mandatory post-2026-03-02): https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0
  - Xero Webhooks documentation — webhook security, intent-to-receive handshake, HMAC-SHA256 signing
  - Xero Webhooks delivery semantics — retry on non-200, event categories (INVOICE, CONTACT)
  - Xero API rate limits — 60 req/min per app + 5 req/sec per tenant
  - Xero Contacts API — `getContacts` filter syntax (`where` parameter, `Phones[]` access patterns)
  - Xero Invoices API — `getInvoices` filter (`Status`, `Contact.ContactID==guid("...")`, `AmountDue`)
  - Xero token revocation: https://identity.xero.com/connect/revocation [VERIFIED via P54 code at xero.js:131]
- **xero-node GitHub:**
  - SDK source for `XeroClient`, `apiCallback`, `updateTenants(false)`, `setTokenSet`, `refreshToken`
  - Issue #339 — `getInvoices` array-param overload returns ALL invoices (use `where` strings instead)

### Tertiary (LOW confidence — flagged for validation)
- **A6 — Xero phone filter exact-match behavior** (Pitfall 1, top uncertainty). Mitigated by Plans 02/06 implementing the adapted Contains+post-filter approach AND recommending a manual demo-company test before lock-in.

---

## Metadata

**Confidence breakdown:**
- Standard stack (Next.js): HIGH — all libraries verified in P54 code
- Standard stack (Python, cross-repo): MEDIUM-HIGH — based on CONTEXT references + livekit-agent existing patterns; not directly readable
- Architecture (Next.js): HIGH — patterns verified via P54 status.js + Stripe webhook + callback route inspection
- Architecture (Python): MEDIUM — extrapolated from `_run_db_queries` shape described in CONTEXT and `check_caller_history.py` template references; planner/executor will confirm by reading agent.py during Plan 06 execution
- Pitfall 1 (phone filter): MEDIUM — Xero docs cited but the exact runtime behavior is best-confirmed by demo-company test
- Pitfall 2 (intent-verify): MEDIUM-HIGH — Xero docs explicit
- Pitfalls 3-7: HIGH — all verifiable in code or directly stated in CONTEXT

**Research date:** 2026-04-17 (regenerated after destructive overwrite)
**Valid until:** 2026-05-17 (30-day window for stable APIs; revisit if Xero deprecates a scope or webhook header schema)

**Regeneration note:** This RESEARCH.md was regenerated after a downstream agent's destructive Write call truncated the original to 59 lines (preserved as `55-RESEARCH.truncated.bak`). All section names match what Plans 01-08 cite. The Open Questions (RESOLVED) section is lifted verbatim from the surviving tail. Plans 01-08 reference checks: ✓ "Pitfall 1" (Plans 02, 06), ✓ "Pitfall 2" (Plan 04), ✓ "Pitfall 3" (xero-tenant-id naming, Plans 02, 04), ✓ "Pitfall 5" (Plans 06, 08), ✓ "Pitfall 6" (Plan 03), ✓ "Pitfall 7" (Plan 01), ✓ Code Examples 1-5 (Plans 02, 04, 06, 07), ✓ Open Questions 1-6 (Plans 01-06), ✓ Validation Architecture (all plans Wave 0).
