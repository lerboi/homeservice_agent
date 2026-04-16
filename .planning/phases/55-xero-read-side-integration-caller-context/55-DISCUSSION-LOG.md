# Phase 55: Xero read-side integration (caller context) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 55-xero-read-side-integration-caller-context
**Areas discussed:** A. Caller-context fetch shape; B. Caching + webhook invalidation; C. Prompt injection + tool + privacy; D. Owner-facing edge UX

---

## Gray Area Selection

**Question presented:** Which gray areas for Phase 55 do you want to discuss?

| Option | Description | Selected |
|--------|-------------|----------|
| A. Caller-context fetch shape | Phone→Xero matching, outstanding filter, lastInvoices shape, unmatched/timeout behavior | ✓ |
| B. Caching + webhook invalidation | cacheTag granularity, webhook signature, invalidation mapping | ✓ |
| C. Prompt injection + tool + privacy | Inject timing, tool return shape, silent-vs-proactive privacy, no-match handling | ✓ |
| D. Owner-facing edge UX | Checklist item, disconnect UX, refresh-failure surfacing, card display | ✓ |

**Notes:** All four areas selected — comprehensive discussion requested.

---

## A. Caller-context fetch shape

### A.1 Phone matching strategy

| Option | Description | Selected |
|--------|-------------|----------|
| E.164 exact match | Query `WHERE Phones.PhoneNumber=="+15551234567"`; fast, predictable, miss→empty context | ✓ (Recommended) |
| Normalized last-N-digits | Strip non-digits, compare last 10; higher match rate, slower, collision risk | |
| E.164 → last-10 fallback | Two round-trips; blows <500ms budget for unmatched | |

**User's choice:** E.164 exact match.

### A.2 Outstanding invoice filter

| Option | Description | Selected |
|--------|-------------|----------|
| AUTHORISED + AmountDue>0 | Standard receivables; include PAID for lastInvoices context | ✓ (Recommended) |
| Overdue-only | Under-reports balance due next week | |
| Include SUBMITTED/DRAFT | Quotes AI on invoices owner hasn't sent; awkward | |

**User's choice:** AUTHORISED + AmountDue>0.

### A.3 `lastInvoices` count + fields

| Option | Description | Selected |
|--------|-------------|----------|
| Last 3 compact | invoiceNumber, date, total, amountDue, status, reference | ✓ (Recommended) |
| Last 5 compact | +400 tokens; dilutes urgency of top items | |
| Last 3 + line-item snippets | Doubles prompt cost; needs second Xero call | |

**User's choice:** Last 3 compact.

### A.4 Fetch timeout / failure policy

| Option | Description | Selected |
|--------|-------------|----------|
| 800ms timeout → skip silently | Log to Sentry; balanced for Xero cold-start | ✓ (Recommended) |
| 1500ms timeout → skip silently | Higher success, risks noticeable greeting delay | |
| 500ms timeout → skip silently | Aggressive; matches p95 but lowest success rate | |

**User's choice:** 800ms timeout → skip silently.

---

## B. Caching + webhook invalidation

### B.1 `cacheTag` granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Two-tier: tenant + tenant+phone | Broad tag for disconnect; specific tag for webhook | ✓ (Recommended) |
| Tenant-wide only | Simpler; wastes recompute on active tenants | |
| Phone-specific only | Disconnect-invalidates-all impractical | |

**User's choice:** Two-tier.

### B.2 Webhook invalidation mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve contact→phone, invalidate specific tag | Extra Xero round-trip on webhook path (not hot path) | ✓ (Recommended) |
| Broad-tag-only | Simpler; higher recompute churn | |
| Claude's discretion | Defer to planner | |

**User's choice:** Resolve contact→phone; fall back to broad tag on resolution failure.

### B.3 Webhook authentication + unknown-tenant handling

| Option | Description | Selected |
|--------|-------------|----------|
| Single app-level HMAC + ignore unknown | XERO_WEBHOOK_KEY env var; 200 OK on ignore | ✓ (Recommended) |
| Single HMAC + 404 unknown | Xero retries on 4xx → retry storms | |
| Per-tenant secret | Xero doesn't model per-tenant secrets | |

**User's choice:** Single app-level HMAC + silent ignore (200 OK).

---

## C. Prompt injection + tool + privacy

**User reinforced the LiveKit prompt-editing philosophy before discussing this area.** Philosophy already saved at `memory/feedback_livekit_prompt_philosophy.md`:
- SDK pin: `livekit-agents==1.5.1` + `livekit-plugins-google@43d3734` (no `per_response_tool_choice`, use `send_realtime_input`)
- Outcome-based for conversational behavior; directive for truth claims + tool prereqs
- Anti-hallucination rules belong near the TOP of the prompt with CRITICAL RULE framing
- Tool returns = STATE + DIRECTIVE (not speakable English); breaks parrot loop
- Preserve persona, trim dead weight (server VAD handles turn-taking)

### C.1 Injection path

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-session block + tool re-serve | Awaits fetch before session.start (800ms budget); tool re-serves cached data | ✓ (Recommended) |
| Post-greeting inject (intake pattern) | Risks hallucination window on first turn | |
| Tool-only | Agent forced to call tool to know anything; invites skip-and-fabricate | |
| Hybrid: minimal top-block + rich tool | Presence signal only; forces tool call for specifics | |

**User's choice:** Pre-session block + tool re-serve.

### C.2 `check_customer_account()` return shape

| Option | Description | Selected |
|--------|-------------|----------|
| STATE + DIRECTIVE string | Per LiveKit philosophy; forces model to translate | ✓ (Recommended) |
| Structured JSON string only | Risks parroting raw values | |
| Prose summary | Speakable English → parrot loop; rejected by philosophy | |

**User's choice:** STATE + DIRECTIVE string.

### C.3 Privacy rule

| Option | Description | Selected |
|--------|-------------|----------|
| Silent awareness; never volunteer | Mirrors `check_caller_history` precedent | ✓ (Recommended) |
| Proactive when contextually relevant | Risky for dunning tone | |
| Tool-gated: agent doesn't know unless caller asks | Strictest; loses silent-booking benefits | |

**User's choice:** Silent awareness; never volunteer.

### C.4 No-Xero-match behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Omit block; tool returns empty-STATE | Caller indistinguishable from cold-call; tool explains absence | ✓ (Recommended) |
| Explicit "not-in-xero" block | Adds prompt weight for common case | |
| Omit everything; tool returns "" | Agent confused by empty return | |

**User's choice:** Omit prompt block; tool returns empty-STATE directive.

---

## D. Owner-facing edge UX

### D.1 `connect_xero` checklist scope (P55 vs. P58)

| Option | Description | Selected |
|--------|-------------|----------|
| Full item with auto-detection | P55 ships functional; P58 polishes copy | ✓ (Recommended) |
| Stub row only | Leaves half-step UX | |
| Defer entirely to P58 | Contradicts P55 roadmap entry | |

**User's choice:** Full item with auto-detection (row presence).

### D.2 Disconnect action behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm → revoke + delete + invalidate | Clean slate; no orphan tokens at Xero | ✓ (Recommended) |
| Confirm → delete row only | Tokens linger valid at Xero | |
| Silent disconnect | Too easy to misfire | |

**User's choice:** Confirm → revoke at Xero + delete row + invalidate cache.

### D.3 Token-refresh failure owner-surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard banner on next visit | No email spam; owner fixes when convenient | |
| Immediate email notification | More proactive; may be ignored | |
| Silent log to Sentry only | User-hostile | |

**User's choice (free text):** "I want both dashboard banner and immediate email notification."
**Notes:** Deliberate override of recommended — a broken Xero integration silently degrades call quality, so both channels ensure visibility.

### D.4 Business Integrations card display content

| Option | Description | Selected |
|--------|-------------|----------|
| Status + connected org + reconnect prompt on error | org name, status line, subtle timestamp, Disconnect | ✓ (Recommended) |
| Minimal: Connected/Disconnected only | Owners wonder "is it working?" | |
| Rich telemetry (match rate, call count) | Belongs in P58 | |

**User's choice:** Status + connected org + reconnect prompt on error.

---

## Claude's Discretion

Areas where the user deferred to implementation judgment during planning:

- Xero Python SDK choice (`xero-python` vs. raw `httpx`) — planner picks based on footprint vs. typing tradeoff.
- Exact `customer_context` prompt-section wording — structure locked (STATE + DIRECTIVE + CRITICAL RULE framing), exact copy per planner, informed by `prompt.py` style and `check_caller_history.py` silent-awareness phrasing.
- `last_context_fetch_at` update cadence (per-fetch vs. cache-cold vs. throttled).
- `error_state` schema shape (new column on `accounting_credentials` vs. JSONB flag vs. separate table).
- Webhook idempotency (dedicated events table vs. rely on Xero delivery + idempotent `revalidateTag`).
- Webhook event subscription scope (INVOICE-only vs. INVOICE + CONTACT).
- `lastInvoices` ordering (`Date` desc vs. `UpdatedDateUTC` desc).
- Exact Python-side location of `integrations/xero.py` in `livekit-agent/src/` tree.
- `check_customer_account()` mid-call re-fetch semantics (re-use cached empty-STATE vs. live re-try).
- Resend email copy for refresh-failure notification (tone-matched to existing `billing_notifications`).

---

## Deferred Ideas (noted for future phases or future polish)

- Xero multi-org picker (currently auto-selects first org).
- Xero rate-limit back-off + retry layer (rely on cache + Xero headroom until telemetry shows throttling).
- Xero contact-creation for walk-in callers (push-side feature; separate phase).
- Python SDK vs. raw HTTP swap.
- `check_customer_account` force-refresh parameter.
- Deep telemetry (match rate, duration histograms, cache hit rate) — CTX-01 in P58.
- Explicit connection-state hint in prompt (currently silent omission).
- Webhook subscription to CONTACT events.
- `accounting_credentials` rename to `integration_credentials` (echo of P54 deferred).
- VIP caller routing interaction (orthogonal; test on that feature's landing).
- Shared `integrations/xero` module between Python and Node (intentional duplication).

---

*Audit log complete. Canonical decisions live in `55-CONTEXT.md`.*
