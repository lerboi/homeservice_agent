# Phase 55: Xero read-side integration (caller context) — Context

**Gathered:** 2026-04-17
**Status:** Ready for UI-SPEC (Business Integrations card gains real Connect/Disconnect + error states) then planning

<domain>
## Phase Boundary

Turn the Phase 54 Xero scaffolding into a live, end-to-end caller-context integration. Deliver in one phase:

1. **Real `fetchCustomerByPhone(tenantId, phone)`** in `src/lib/integrations/xero.js` — returns `{ contact, outstandingBalance, lastInvoices, lastPaymentDate }` from Xero via `xero-node` SDK, behind `'use cache'` + two-tier `cacheTag` with 5-min `cacheLife`. E.164-exact phone matching against `Phones.PhoneNumber`; outstanding scoped to `AUTHORISED + AmountDue>0`; last 3 invoices with compact fields.
2. **Live OAuth end-to-end** at `/api/integrations/xero/{auth,callback}` — Phase 54 scaffolds return 501 today; P55 wires them to the unified-scope OAuth flow (`openid profile email accounting.transactions accounting.contacts offline_access`) with refresh-aware token getter. Disconnect revokes at Xero + deletes row + invalidates tenant-wide cache tag.
3. **`/api/webhooks/xero` endpoint** — single app-level HMAC secret (`XERO_WEBHOOK_KEY`) verification, 200 OK on all verified signatures (silent-ignore for unknown tenants to prevent retry storms), resolves `invoice.contactId` → contact phone → `revalidateTag('xero-context-${tenantId}-${phoneE164}')`; falls back to broad tenant tag if contact has no phone. Handles Xero's webhook-intent-verification handshake.
4. **Business Integrations frontend wiring** — Phase 54's `BusinessIntegrationCard` shell gets the real Connect/Disconnect interactions, shows `display_name` (Xero org) when connected, shows a "Reconnect needed" banner when token refresh fails, subtly surfaces `last_context_fetch_at`. Zero UI flashes caller-specific data.
5. **`connect_xero` setup checklist item** — P55 adds the row to `/api/setup-checklist` with completion auto-detected by `accounting_credentials` row presence (`provider='xero'`). P58 only polishes copy/ordering later.
6. **Python agent (`livekit-agent/`) Xero hookup** —
   - New `livekit-agent/src/integrations/xero.py` — service-role Supabase reads `accounting_credentials` row, direct Xero REST fetch with refresh-aware token logic (Python side), returns the same `{contact, outstandingBalance, lastInvoices, lastPaymentDate}` shape.
   - `_run_db_queries` in `agent.py:316` gains a fourth parallel task: `xero_context_task` with **800ms timeout**; on timeout/exception, `customer_context` is silently omitted (Sentry logged).
   - **Pre-session injection** — fetch is awaited before `session.start()` resolves the greeting, so the initial system prompt already contains a STATE-framed `customer_context` block near the top of the prompt with the same CRITICAL RULE framing used for anti-hallucination rules.
   - New `check_customer_account()` tool (registered in `src/tools/__init__.py`) re-serves the fetched data as a **STATE + DIRECTIVE** string — not speakable English — per the pinned LiveKit prompt philosophy (see canonical ref).
7. **Token-refresh failure surfacing** — when background refresh fails (refresh_token revoked), persist error-state hint on `accounting_credentials` AND send a Resend email to the tenant owner. Card shows a "Reconnect needed" banner on next visit.
8. **Telemetry seed** — every successful fetch updates `accounting_credentials.last_context_fetch_at`. Deeper telemetry (match rate, duration histograms) stays in P58.

Explicitly **out of scope** (hard boundaries):

- **No Jobber work.** P56 owns Jobber's parallel surface. P55 keeps Jobber adapter at 501 stub.
- **No multi-Xero-org picker.** Keep Phase 35's "auto-select first tenant/organization after OAuth" behavior. Multi-org selection lands in a later polish phase if real owner demand emerges.
- **No Xero rate-limit back-off layer.** Xero caps at 60 req/min per app + 5 req/sec per tenant — acceptable headroom for webhook + call-path volume; cache absorbs the rest. Revisit in P58 or later if real throttling is hit.
- **No deep telemetry UI.** Match rate + duration histograms + cache-hit rate surface in P58.
- **No LiveKit agent framework changes.** Tool registration + prompt section + one new parallel task — no changes to `AgentSession`, `VocoAgent` class, SIP handling, post-call pipeline, or the pinned SDK versions.
- **No Xero-side data writes.** Phase 35's invoice push stays gated behind the `invoicing` flag (P53). P55 is strictly read-side.
- **No contact-creation-on-caller-match.** If the phone matches no Xero contact, `customer_context` is simply omitted from the prompt. Creating a Xero contact for walk-in callers is out of scope.
- **No change to Phase 54's `accounting_credentials` schema.** Migration 051 already shipped `scopes TEXT[]` and `last_context_fetch_at TIMESTAMPTZ`. P55 uses the columns as-is.

</domain>

<decisions>
## Implementation Decisions

### Area A — Caller-context fetch shape

- **D-01 (Phone matching):** E.164 exact match via Xero Contacts API `WHERE Phones.PhoneNumber=="${phoneE164}"`. No normalization fallback. Miss rate acceptable because fallback is empty `customer_context` (call proceeds normally). Simpler, predictable, and stays within <500ms p95 budget without a second round-trip.
- **D-02 (Outstanding filter):** `outstandingBalance` = sum of `AmountDue` across invoices with `Status=AUTHORISED AND AmountDue>0`. `lastInvoices` = most recent 3 invoices with `Status IN (AUTHORISED, PAID)` (includes PAID so agent sees recent job activity, not just debt). `lastPaymentDate` = `MAX(FullyPaidOnDate)` across PAID invoices. `DRAFT`, `SUBMITTED`, `VOIDED` excluded everywhere.
- **D-03 (`lastInvoices` shape):** 3 entries. Fields per entry: `invoiceNumber`, `date`, `total`, `amountDue`, `status`, `reference` (short memo/description). No line items — keeps prompt budget predictable and avoids the extra "expand lineItems" Xero call.
- **D-04 (Fetch timeout):** Python side `_run_db_queries` races the Xero fetch against an **800ms** timeout. On timeout or exception: `customer_context` is omitted from the system prompt, Sentry captures the failure with `tenantId` + `phone` (hashed) tags. Tolerates Xero cold-start variance while keeping greeting latency tight.

### Area B — Caching + webhook invalidation

- **D-05 (cacheTag granularity):** Two-tier tags on every `fetchCustomerByPhone` cache entry:
  - Broad: `xero-context-${tenantId}` — invalidated on disconnect, reauth, and webhook payloads where contact→phone resolution fails.
  - Specific: `xero-context-${tenantId}-${phoneE164}` — invalidated on webhooks where contact→phone succeeds.
- **D-06 (Webhook → cache invalidation):** Webhook handler resolves invoice/contact events to a phone. Path: parse payload → for each event, GET the invoice (or contact directly) → extract `Phones[].PhoneNumber` → for each phone, `revalidateTag('xero-context-${tenantId}-${phoneE164}')`. If the contact has no phone or the lookup fails, fall back to `revalidateTag('xero-context-${tenantId}')`. The extra Xero round-trip lives on the webhook path, NOT the call hot path.
- **D-07 (Webhook auth + unknown-tenant handling):** Single app-level `XERO_WEBHOOK_KEY` env var (Xero assigns at app level, not per-tenant). Verify HMAC-SHA256 on the raw body; return 401 on bad signature; return 200 on good signature even when the payload's Xero `tenantId` doesn't map to any connected `accounting_credentials` row (silent-ignore prevents Xero retry storms for events we don't care about). Also implements Xero's webhook-intent-verification 200/401 handshake on initial subscription.

### Area C — Prompt injection + tool + privacy

- **D-08 (Injection path):** **Pre-session block + tool re-serve.** In `agent.py` `_run_db_queries`, the Xero fetch is launched in parallel with the other DB tasks but its result is **awaited before `session.start()`** resolves the greeting (bounded by the D-04 timeout). The initial system prompt built by `prompt.build_system_prompt` includes a `customer_context` block near the top of the prompt, framed with CRITICAL RULE language matching the existing anti-hallucination section. `check_customer_account()` re-serves the same (already-fetched) data on demand — no re-fetch, no extra Xero call — so the tool is cheap.
- **D-09 (`check_customer_account` return shape):** Returns a **STATE + DIRECTIVE** string per `feedback_livekit_prompt_philosophy.md`. Never speakable English. Example return:
  ```
  STATE: contact=John Smith; outstanding=$847.25 across 2 invoices; last_invoice=INV-1042 $500 due 2026-04-10 (overdue); last_payment=2026-03-15.
  DIRECTIVE: Answer factually only if the caller explicitly asks about their balance, bill, or recent work. Do not read invoice numbers unless asked. Do not volunteer figures.
  ```
  Breaks the parrot loop by forcing the model to translate rather than recite.
- **D-10 (Privacy rule):** Silent awareness; never volunteer. Mirrors the `check_caller_history` precedent in `livekit-agent/src/tools/check_caller_history.py:107-117`. Agent must never proactively mention outstanding balance, invoice numbers, or past job descriptions. Facts are answered factually ONLY when the caller explicitly asks about their account, bill, or recent work. If asked "do you have my info?" → confirm presence without specifics ("we have your contact on file").
- **D-11 (No-match behavior):** When the phone matches no Xero contact (OR when Xero is disconnected), the `customer_context` prompt block is **omitted entirely** — caller is indistinguishable from a cold-call first-time caller. If the agent still invokes `check_customer_account()`, the tool returns:
  ```
  STATE: no_xero_contact_for_phone.
  DIRECTIVE: Treat as new or walk-in customer. Do not claim to have any records on file.
  ```
  Same shape for disconnected-Xero case (uniform behavior).

### Area D — Owner-facing edge UX

- **D-12 (`connect_xero` checklist item — full auto-detection in P55):** `/api/setup-checklist` response includes a `connect_xero` item. Completion auto-detected by presence of `accounting_credentials` row with `provider='xero'` for the tenant. P58 polishes copy/ordering but the functional wiring ships in P55 so the feature is shippable end-to-end on merge day.
- **D-13 (Disconnect action):** AlertDialog confirmation → on confirm: (1) call Xero's token revoke endpoint via `xero-node` SDK, (2) delete the `accounting_credentials` row, (3) `revalidateTag('xero-context-${tenantId}')` to wipe all cached caller contexts for that tenant. Dialog copy should emphasize reversibility: "Disconnect Xero? Your AI receptionist will stop seeing caller account details. You can reconnect anytime."
- **D-14 (Token-refresh failure surfacing — BOTH banner + email):** When background refresh fails (e.g., refresh_token revoked at Xero):
  - Persist `error_state` hint on the `accounting_credentials` row (column add — planner picks schema: dedicated `error_state TEXT NULL` column, or JSONB flag).
  - Send a Resend email to the tenant owner: subject "Your Xero connection needs attention"; body mentions the caller-context feature and a CTA link to `/dashboard/more/integrations`.
  - Business Integrations card on next owner visit renders a "Reconnect needed — Xero token expired" banner with a prominent Reconnect button (re-runs the OAuth flow, overwrites the existing row via upsert).
  - Call path behavior stays as D-04 (800ms timeout → silent skip).
- **D-15 (Card content):** Xero card on `/dashboard/more/integrations` displays:
  - **Connected state:** org `display_name` from OAuth, status line from P54 ("Sharing customer context with your AI receptionist" / "... + sending invoices" when invoicing flag ON), subtle `last_context_fetch_at` timestamp (omit when null), Disconnect button.
  - **Error state:** Reconnect banner per D-14, Reconnect button instead of Disconnect.
  - **Disconnected state:** connect-CTA copy from P54, Connect Xero button.
  - No match-rate, no call count, no duration histogram — those land in P58 (CTX-01 telemetry work).

### Claude's Discretion

- **Xero Python SDK choice (`xero-python` vs. raw `httpx`):** Python side can use the official `xero-python` package or hand-rolled `httpx` calls. `xero-python` brings typed models but adds a dependency; `httpx` is already a transitive dep and gives exact control over timeouts. Planner picks based on footprint vs. correctness tradeoff.
- **Exact `customer_context` prompt-section wording:** Structure (STATE + DIRECTIVE + CRITICAL RULE framing) is locked; exact copy for each field label and the privacy prohibitions is planner/implementer's call, informed by `prompt.py` style and reusing phrasing from `check_caller_history.py:107-117`.
- **`last_context_fetch_at` update cadence:** Update on every successful fetch vs. only when cache is cold vs. throttle to once-per-minute. Low-cost write; planner decides.
- **`error_state` schema shape:** Dedicated column vs. JSONB flag on `accounting_credentials`. If a new migration is needed for the column, it's `052_xero_error_state.sql`. Alternative: store in a separate lightweight table if the column feels cramped.
- **Webhook handler idempotency key:** Xero webhook payloads carry event timestamps and IDs. Planner decides whether to dedup in a small `xero_webhook_events` table (pattern from `stripe_webhook_events`) or trust Xero's delivery semantics + rely on `revalidateTag` being idempotent.
- **Xero webhook event subscription scope:** INVOICE-only vs. INVOICE + CONTACT. Default to INVOICE (covers `AUTHORISED`, `PAID`, `VOIDED` state changes which drive `outstandingBalance`). Add CONTACT events only if caller-name or phone updates prove important — likely not.
- **Ordering of `lastInvoices`:** Newest-first by `Date` vs. by `UpdatedDateUTC`. Planner picks whichever reads most usefully in the prompt (recent-job-activity perspective).
- **Where `integrations/xero.py` lives on the Python side exactly:** `livekit-agent/src/integrations/xero.py` is the intent; if the `integrations/` dir doesn't exist yet, create it (sibling to `lib/`, `tools/`, `messages/`). Planner confirms after reading the agent tree.
- **How `check_customer_account()` tool handles mid-call reconnection**: if the caller's phone wasn't matched initially (no block in prompt) but the tool is invoked, it re-uses the cached empty-STATE directive. Planner decides whether to attempt a mid-call Xero re-fetch — probably not worth the latency.
- **Resend email template tone:** Professional, short, no marketing copy. Planner drafts matching existing `billing_notifications` email voice.

### Folded Todos

None. STATE.md's only Xero-adjacent pending todo — "User to register Xero dev account" — is an external user action (blocks execution, not planning/context).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + Scope
- `.planning/REQUIREMENTS.md` lines 29-34 — XERO-01, XERO-02, XERO-03, XERO-04 (authoritative requirement text)
- `.planning/ROADMAP.md` line 194 — Phase 55 checklist entry (scope line)
- `.planning/ROADMAP.md` lines 246-256 — Phase 55 detailed section (Goal, Depends on, Requirements, Pre-req user actions)
- `.planning/ROADMAP.md` lines 202 — Pre-requisite user action (Xero dev app registration)
- `.planning/ROADMAP.md` lines 204-212 — v6.0 Key Decisions (Python-direct fetches, Next.js 16 caching scope, `accounting_credentials` reuse)

### Prior Phase Context (LOCKED decisions to carry forward)
- `.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md` — P54 locks: unified OAuth scope bundle (D-03), `/api/integrations/**` canonical routes (D-05), `src/lib/integrations/xero.js` location (D-02), cache/revalidate loop shape (D-10), Migration 051 schema (D-11..D-15)
- `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md` — invoicing flag gate context. Note: P55's `/api/integrations/**` routes and `/api/webhooks/xero` are NOT gated by the invoicing flag (caller-context is valuable regardless of invoicing-push state). Card status-line copy (D-04 in P54) does reference the flag.
- `.planning/phases/35-invoice-integrations-and-ai/35-CONTEXT.md` — original Xero push-side decisions (D-01..D-05), OAuth scope reference, invoice push flow that stays gated by invoicing flag

### User Preferences & Critical Rules (MUST read before Area C implementation)
- `memory/feedback_livekit_prompt_philosophy.md` — **REQUIRED reading before touching `prompt.py` or tool returns.** Codifies: outcome-based conversational guidance, directive framing for truth claims, anti-hallucination CRITICAL RULE positioning near prompt top, STATE+DIRECTIVE tool-return shape (not speakable English), SDK pin (`livekit-agents==1.5.1` + `livekit-plugins-google@43d3734`), persona preservation. D-08/D-09/D-10 are direct applications of this philosophy.

### Architectural Skills (read before implementing, update after)
- `voice-call-architecture` — Python agent entry flow, `_run_db_queries` parallelization pattern, `VocoAgent` class, deps dictionary, post-call pipeline; **must update** after P55 lands (new tool, new prompt section, new integration module)
- `auth-database-multitenancy` — service-role Supabase reads from Python (agent), RLS on `accounting_credentials`, `getTenantId()` on Next.js side, migration pattern if D-14's `error_state` needs a new column
- `dashboard-crm-system` — `/dashboard/more/*` page conventions, card component patterns, AlertDialog usage, banner treatments; **must update** after P55 lands if Business Integrations card gains new states
- `payment-architecture` — reference for webhook handler shape (`stripe_webhook_events` idempotency table pattern, signature verification, raw-body handling, 200-OK-on-ignore pattern)
- `nextjs-16-complete-guide` — `'use cache'` directive placement, `cacheTag` + `revalidateTag` patterns, `cacheLife` for the 5-min TTL
- `onboarding-flow` — `/api/setup-checklist` response shape + completion-detection conventions (for D-12)

### External Docs (research phase)
- Xero Developer docs — OAuth 2.0 + `xero-node` SDK docs (covers scope bundle, token refresh, `updateTenants()` multi-org behavior)
- Xero Webhooks docs — webhook-intent-verification handshake, HMAC-SHA256 signature spec, event type catalogue (INVOICE / CONTACT), delivery retry semantics
- Xero API rate limits reference — 60 req/min per app + 5 req/sec per tenant (shapes webhook handler's re-fetch strategy in D-06)

### Existing Code Worth Reading
- **Next.js side:**
  - `src/lib/integrations/xero.js` — P54-unified adapter with OAuth + push methods; P55 adds `fetchCustomerByPhone` here
  - `src/lib/integrations/status.js` — P54 cache-tag pattern; template for `fetchCustomerByPhone`'s caching
  - `src/app/api/integrations/[provider]/auth/route.js` — P54 scaffold; P55 wires it
  - `src/app/api/integrations/[provider]/callback/route.js` — P54 scaffold; P55 wires it + upsert on `accounting_credentials`
  - `src/app/api/integrations/disconnect/route.js` — P54 scaffold; P55 adds Xero-side revoke + `revalidateTag`
  - `src/app/api/integrations/status/route.js` — P54-complete; read-only reference
  - `src/app/api/stripe/webhook/route.js` — webhook handler pattern (signature verification, raw body, idempotency table, 200-on-ignore)
  - `src/app/api/setup-checklist/route.js` — pattern for adding `connect_xero` row (D-12)
  - `src/components/dashboard/BusinessIntegrationCard.jsx` (or `AccountingConnectionCard.jsx` if P54 kept the name) — card shell to extend for D-15 states
  - `src/lib/notifications.js` — `getResendClient()` for D-14 email
- **Python side (`livekit-agent/`):**
  - `src/agent.py:316-401` — `_run_db_queries` function; P55 adds the fourth parallel task + awaits before `session.start()`
  - `src/supabase_client.py` — `get_supabase_admin()` for service-role Xero credential reads
  - `src/prompt.py` — `build_system_prompt`; P55 inserts `customer_context` block near top
  - `src/tools/check_caller_history.py` — **structural template for `check_customer_account`** (silent-awareness rules verbatim apply; factory pattern identical)
  - `src/tools/__init__.py` — tool registration; P55 adds `check_customer_account`
  - `src/lib/phone.py` — `_normalize_phone` for E.164 normalization of `from_number` before Xero lookup

### New Files to Create (planner confirms exact paths)
- **Next.js side:**
  - `src/app/api/webhooks/xero/route.js` — HMAC verification + webhook-intent verification + contact→phone resolution + `revalidateTag`
  - Possibly `src/lib/integrations/webhook-verify.js` — if HMAC helper warrants extraction (Claude's discretion)
  - Possibly `supabase/migrations/052_xero_error_state.sql` — only if D-14 uses a dedicated column (Claude's discretion)
  - Possibly `supabase/migrations/052_xero_webhook_events.sql` — only if webhook handler uses an idempotency table (Claude's discretion)
- **Python side:**
  - `livekit-agent/src/integrations/__init__.py`
  - `livekit-agent/src/integrations/xero.py` — service-role `accounting_credentials` read + Xero REST fetch + refresh handling
  - `livekit-agent/src/tools/check_customer_account.py` — STATE+DIRECTIVE tool factory, pattern matched to `check_caller_history.py`

### Files Modified in Phase 55
- **Next.js side:**
  - `src/lib/integrations/xero.js` — add `fetchCustomerByPhone`, cache tags, revoke on disconnect
  - `src/app/api/integrations/xero/auth/route.js` — wire real OAuth
  - `src/app/api/integrations/xero/callback/route.js` — wire real callback + upsert
  - `src/app/api/integrations/disconnect/route.js` — add Xero revoke + `revalidateTag`
  - `src/app/api/setup-checklist/route.js` — add `connect_xero` item
  - `src/components/dashboard/BusinessIntegrationCard.jsx` — connected/error/disconnected states, Reconnect banner, Disconnect AlertDialog, `last_context_fetch_at` timestamp, Resend email trigger hookup
  - `src/app/dashboard/more/integrations/page.js` — light touch if card-state orchestration lives here
  - `.env.example` — add `XERO_WEBHOOK_KEY`
- **Python side:**
  - `livekit-agent/src/agent.py` — add `xero_context_task` to `_run_db_queries`, 800ms race, pass result to `build_system_prompt`
  - `livekit-agent/src/prompt.py` — new `customer_context` block near top of prompt, CRITICAL RULE framing, silent-awareness rules
  - `livekit-agent/src/tools/__init__.py` — register `check_customer_account`
  - `livekit-agent/.env.example` — add Xero-related vars if any Python-specific (reuses `XERO_CLIENT_ID` etc. from Next.js .env)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/integrations/xero.js`** (P54-migrated) — already has `XeroClient` setup, `getAuthUrl`, `exchangeCode`, `refreshToken`, `setCredentials`, unified scope bundle. P55 adds `fetchCustomerByPhone` as a new method and `revoke` (if not already added by P54). Cache directive + cacheTag wraps the new method.
- **`src/lib/integrations/status.js`** (P54) — proven `'use cache'` + `cacheTag` + `revalidateTag` loop. P55 uses the exact same primitive shape for `fetchCustomerByPhone`.
- **`check_caller_history.py`** — factory pattern `create_check_caller_history_tool(deps)`, silent-awareness privacy rules verbatim applicable, `@function_tool` decorator shape, `asyncio.to_thread` Supabase wrapper, graceful-degradation ("return no info if query fails") pattern.
- **`_run_db_queries` existing shape** — already launches 3 parallel tasks (subscription, intake, call-record) with `asyncio.gather(..., return_exceptions=True)`. Adding a 4th task is a small surgical change; the existing `await session_ready.wait()` + `generate_reply` pattern is NOT used for `customer_context` because D-08 locks pre-session injection.
- **`stripe_webhook_events` table + handler** (payment-architecture skill) — canonical idempotency pattern: UNIQUE `event_id`, INSERT-OR-IGNORE on receipt, 200 OK without processing on conflict.
- **HMAC-SHA256 verification pattern** — already used in `src/app/api/google-calendar/auth/route.js` (`verifyOAuthState`); webhook signature verification follows a similar shape against Xero's `x-xero-signature` header.
- **Resend email pattern** — `getResendClient()` in `src/lib/notifications.js`, existing templates for `billing_notifications` emails serve as tone reference for D-14.

### Established Patterns
- **Xero-node SDK wrapping** — Phase 35's existing `src/lib/accounting/xero.js` (now `src/lib/integrations/xero.js` post-P54) is the canonical SDK-wrap style; reuse same private `_createXeroClient` helper for read paths.
- **Cache tag naming** — P54's `integration-status-${tenantId}` establishes the `${domain}-${scope}-${id}` convention; P55's `xero-context-${tenantId}` and `xero-context-${tenantId}-${phoneE164}` follow suit.
- **Webhook endpoint structure** — `/api/webhooks/<provider>` is the canonical location (not `/api/integrations/<provider>/webhook`) per REQUIREMENTS XERO-03 wording. Matches Stripe, Google Calendar, Outlook precedents.
- **Setup checklist row** — `/api/setup-checklist` returns an array of `{id, label, completed, target_url}` items; adding `connect_xero` follows the established shape (checklist references onboarding-flow skill).
- **Python agent tool factory** — `create_<tool_name>_tool(deps)` returning a function decorated with `@function_tool(name, description)`; registered in `src/tools/__init__.py`.
- **Service-role Supabase in Python** — `get_supabase_admin()` from `supabase_client.py` bypasses RLS for system reads; correct entry for P55's Xero credential reads.

### Integration Points
- **`_run_db_queries` in `agent.py:316`** — 4th parallel task slot; the function already uses `asyncio.gather` + `return_exceptions=True`, so adding a new coroutine is mechanical.
- **`build_system_prompt` in `prompt.py`** — accepts parameters like `tenant`, `intake_questions`; add `customer_context` param (string or None). When None, section is omitted entirely (D-11).
- **Business Integrations card** — P54's card component is where Connect / Disconnect + status variants render. P55 extends without restructure.
- **Setup checklist response** — `/api/setup-checklist/route.js` response array; P55 appends one item.
- **`.env.example`** — add `XERO_WEBHOOK_KEY`; existing `XERO_CLIENT_ID` + `XERO_CLIENT_SECRET` from P54 reused.

### Blast Radius
- **Next.js side:** ~7-10 source files touched — 3-4 route handlers (auth/callback wire, disconnect extend, new webhook route, setup-checklist append), 1-2 component files (BusinessIntegrationCard states), 1 lib file (integrations/xero.js — new method), 0-2 migration files (only if `error_state` or `xero_webhook_events` use dedicated columns/tables), 1 .env.example.
- **Python side:** 5-6 source files — 1 new `integrations/xero.py`, 1 new `tools/check_customer_account.py`, 1 `tools/__init__.py` (append registration), 1 `agent.py` (4th task), 1 `prompt.py` (new section), possibly 1 `.env.example`.
- **Plan shape:** likely 5-7 plans. Candidate partition (planner confirms):
  1. Next.js `fetchCustomerByPhone` + cache primitive + xero adapter extension
  2. Real OAuth wire-up (auth/callback/disconnect routes)
  3. Webhook endpoint (signature + intent-verification + contact→phone invalidation)
  4. Business Integrations card states + setup checklist item + Resend email on refresh failure
  5. Python `integrations/xero.py` + agent `_run_db_queries` 4th task
  6. Python `check_customer_account` tool + prompt.py `customer_context` section
  7. Skill + ROADMAP + STATE updates
- **UI-SPEC needed:** yes. Card gets new states (Reconnect banner, error banner with CTA, subtle timestamp, Disconnect dialog), refresh-fail email copy, AlertDialog copy. Invoke `/gsd:ui-phase 55` after CONTEXT, before `/gsd:plan-phase 55`.

### Known Pitfalls
- **Greeting latency from D-08 pre-session await:** The 800ms Xero budget sits in front of `session.start()` — measure real-world greeting-latency impact on staging before Phase-55 merge. If greeting delay feels laggy, alternate is to inject via `generate_reply` post-greeting (D-08's rejected option B) but accept the hallucination window.
- **`'use cache'` directive placement** — must be the VERY FIRST line inside the function (per P54's D-10 pitfall). Easy to miss when extending `xero.js`.
- **`xero-node` tenant selection** — existing code auto-picks the first Xero org after OAuth (line 64-65 of Phase 35's `xero.js`). If the owner has multiple orgs, `fetchCustomerByPhone` queries only the first. Flag as a deferred improvement; document clearly in `customer_context` prompt that only one org is queried.
- **Xero webhook intent verification** — Xero probes a newly-registered webhook with a special payload expecting 200 + specific body; handler must cover this handshake before it can receive real events. Research phase should confirm exact handshake shape against Xero's current docs.
- **Python-side refresh-token write-back** — when the Python agent refreshes a Xero token (during a fetch), it must persist the new token set back to `accounting_credentials`. Service-role UPDATE with `eq('tenant_id', tenantId).eq('provider', 'xero')`. Without write-back, Next.js side sees stale tokens.
- **Webhook re-fetch amplifying Xero rate limits** — D-06 adds a Xero GET per webhook event. Bursts of invoice status changes could rate-limit the webhook handler. Handler should degrade gracefully to broad-tag invalidation on 429s.
- **Token-refresh failure race with active call** — if refresh fails mid-call, the 800ms timeout in `_run_db_queries` catches it and `customer_context` is skipped for that call. But the refresh-failure notification email should NOT fire from the call path (noisy); fire it from the dashboard-side refresh attempts or a small cron that detects failed-refresh state once per hour.
- **Invoice-intent "speakable" language creeping into the prompt block** — D-08/D-09 lock STATE+DIRECTIVE framing, but it's tempting during implementation to "make the prompt readable" by humanizing the block. Don't. The block is for Gemini, and humanized prose invites parroting.
- **Silent-awareness privacy rule and the "confirmed account" parrot** — per the LiveKit philosophy memory, words like "confirmed," "verified," "on file" tied to verifiable claims need the same prohibition treatment. Prompt block must prohibit "I have verified..." / "Your account is confirmed..." style phrasing unless it directly reflects a tool-returned STATE.

</code_context>

<specifics>
## Specific Ideas

- **"Pre-session block + tool re-serve" is a hybrid by design** — the prompt block gives the agent baseline awareness (so it doesn't have to call the tool to know anything), and the tool exists for two cases: (a) the agent needs to re-surface specifics after a long conversation (prompt attention drift), and (b) the caller explicitly asks about their balance / recent work, in which case a tool call acts as a truth-gate against hallucinated figures. The tool is cheap — it re-serves cached data, not a live re-fetch.
- **Silent awareness as a trust signal** — callers who owe $847 don't want the AI receptionist leading with it. The silent-awareness rule (D-10) isn't just "nice" — it's the difference between Voco feeling like a thoughtful assistant and Voco feeling like a collections agent. This is especially important for home-service trades where repeat customers are the lifeblood.
- **Omit > explicit-not-found** — showing "caller not in Xero" (D-11's rejected option B) in the prompt creates cognitive load for the agent and risks the AI accidentally speaking about the absence ("I don't see you in our system — are you new?"), which itself is a trust-negative surprise for walk-in callers who happen to not be in Xero. Just omit.
- **Two-tier cacheTag (D-05) is strictly better than tenant-wide** — Even for tenants with high call volume, the broad `xero-context-${tenantId}` tag preserves the disconnect-invalidates-all property, while per-phone tags keep webhook invalidation surgical. No downside beyond slightly more tag strings, which is negligible.
- **App-level webhook secret (D-07) matches Xero's model** — Xero assigns webhook signing keys at the app level (one per OAuth app, not per connected org). A per-tenant secret would be invented out of thin air and would require our own key-distribution layer. Stick with the platform's model.
- **Token-refresh email + banner combo (D-14)** — this is the one place the user deviated from the recommended default, and deliberately: a broken Xero integration silently degrades call-context quality, and owners won't notice unless the error surface is loud enough. Both channels ensure it reaches them.
- **`connect_xero` checklist in P55, polish in P58** — P58's CHECKLIST-01 requirement is "completion auto-detected via `accounting_credentials` row presence" — exactly the D-12 approach. P55 ships the functional item; P58 only touches copy/ordering. No scope conflict, no half-step UX.
- **Reuse `check_caller_history`'s privacy rules verbatim** — the tool already contains battle-tested phrasing ("NEVER mention this history to the caller... NEVER say you have their information on file... Ask every question as if this is the very first time..."). Copy the exact phrasing into the `customer_context` block + `check_customer_account` tool, swapping "history" for "account" where appropriate. Consistent behavior across both tools = less Gemini confusion.

</specifics>

<deferred>
## Deferred Ideas

- **Xero multi-org picker** — currently auto-selects first Xero organization after OAuth. If owners have multiple Xero orgs, only one is queried. Add an org-picker during OAuth or in the Business Integrations card if real owner demand emerges (likely during P58 or post-GA).
- **Xero rate-limit back-off layer** — currently rely on the 5-min cache + Xero's headroom (60 req/min / 5 req/sec per tenant). Add explicit back-off + retry logic only if telemetry shows real throttling (P58 telemetry will reveal it).
- **Xero contact-creation on caller match-fail** — when a caller isn't in Xero, we omit `customer_context`. Could proactively create a Xero contact for walk-in callers using captured lead data, but that's a push-side feature conflating with the invoicing flag. Defer to a future "Xero customer autocreation" phase gated by invoicing flag.
- **Python SDK vs. raw HTTP for Xero fetches** — planner picks; if choice proves awkward post-merge, swap is contained to `livekit-agent/src/integrations/xero.py`. No external API commitment.
- **`check_customer_account` mid-call re-fetch** — current design re-serves cached data. If a caller's balance changes mid-call (rare) and the tool is called post-webhook-invalidation, the cache miss triggers a live fetch — fine. Add a "force-refresh" tool parameter only if a real use case emerges.
- **Deep telemetry (match rate, duration histograms, cache hit rate)** — CTX-01 in P58. `last_context_fetch_at` is seeded in P55 as a foundation.
- **Agent awareness of Xero connection state during conversation** — currently silent. If disconnected, prompt block omitted. If connected but fetch failed (timeout), block omitted. Could expose this via a "connection_state" hint, but adds prompt weight for edge cases.
- **Webhook subscription to CONTACT events** — defer until clear evidence caller phone-number updates in Xero outpace the 5-min cache TTL's ability to self-heal.
- **Rename `accounting_credentials` → `integration_credentials`** — echoes P54's deferred rename. Still out of scope.
- **RLS-tightening on `accounting_credentials`** — Python reads via service role (correct). Verify no dashboard-facing route leaks the raw token columns to a client component.
- **VIP caller routing interaction** — memory notes a future VIP-caller routing feature bypassing the AI for specific numbers/leads. Orthogonal to P55 but should be tested that `customer_context` injection doesn't break VIP bypass when it lands.
- **Shared `integrations/xero.py` module between Python and Node** — out of scope; Python and Node sides intentionally duplicate (different runtime, different SDK choices, different concerns).

</deferred>

---

*Phase: 55-xero-read-side-integration-caller-context*
*Context gathered: 2026-04-17*
