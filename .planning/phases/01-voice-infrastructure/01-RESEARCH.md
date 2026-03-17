# Phase 1: Voice Infrastructure - Research

**Researched:** 2026-03-18
**Domain:** Retell AI webhooks, Supabase multi-tenant schema, Next.js i18n translation layer
**Confidence:** HIGH (core stack verified against live npm registry and official docs)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Language Support Scope**
- English + Spanish supported from day one
- When language detection is uncertain, AI asks: "Would you prefer English or Spanish?"
- Code-switching: AI mirrors the caller's language — responds in whatever language the caller just used
- Unsupported languages: AI detects, apologizes in that language, gauges urgency from tone/keywords, creates a lead tagged "LANGUAGE BARRIER: [Detected Language]", escalates to owner with priority notification
- All user-facing strings keyed through a translation layer — no raw English strings hardcoded in application logic

**Recording & Transcript Handling**
- Recordings stored indefinitely — no auto-delete, owner can manually delete
- Storage: Supabase Storage for call recordings
- Transcripts stored in both formats: structured (speaker turns, timestamps, speaker labels) and plain text
- Always announce recording at start of every call: "This call may be recorded for quality purposes."

**Default Call Behavior**
- Generic professional greeting when business hasn't completed onboarding: "Hello, thank you for calling. How can I help you today?"
- Warm professional default persona: friendly, calm, mid-pace voice
- When caller's request can't be handled: capture caller info as a lead AND attempt to transfer to owner's phone
- 10-minute soft call duration limit — AI wraps up after 10 minutes

**Tech Stack & Framework**
- Next.js with JavaScript (no TypeScript) — full-stack framework with API routes + React dashboard
- Full Supabase stack: Postgres DB, Supabase Auth, Supabase Storage, Realtime subscriptions
- Deployment: Vercel — serverless functions for API routes
- Multi-tenant: shared tables with tenant_id column, row-level security via Supabase RLS

### Claude's Discretion

- Retell webhook handler architecture and event processing
- Exact Retell voice selection for warm professional persona
- Database schema design details (table structure, indexes, relationships)
- Translation layer implementation approach (i18n library choice)
- Error handling and retry strategies for webhook processing

### Deferred Ideas (OUT OF SCOPE)

- WhatsApp alerts for language barrier escalation — Phase 4 (NOTIF-01, NOTIF-02)
- Per-business configurable recording consent toggle — always-announce is v1 default
- Singlish language support — start with English + Spanish, expand later

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-01 | AI answers every inbound call within 1 second via Retell with natural-sounding voice | Retell inbound webhook (`call_inbound` event) + agent pre-configuration enables sub-second pickup; webhook must respond within 10 seconds |
| VOICE-05 | AI detects caller's language on first utterance and switches to appropriate language seamlessly | Retell multilingual mode auto-detects from first utterance; prompt must include explicit language-mirroring instructions |
| VOICE-06 | AI handles code-switching (Spanish/mixed language) without breaking conversation flow | Retell's multilingual `codeswitch` behavior works when agent language is set to multilingual; prompt controls response language mirroring |
| VOICE-08 | Call recording stored and accessible per lead in dashboard | Retell `call_analyzed` webhook delivers `recording_url`; fetch audio, upload to Supabase Storage bucket, store path in DB |
| VOICE-09 | Call transcript generated and stored per lead in dashboard | Retell delivers `transcript` (plain text) and `transcript_object` (structured utterances with timestamps); both stored in DB |

</phase_requirements>

---

## Summary

Phase 1 establishes the foundational infrastructure that all subsequent phases build on. The three pillars are: (1) the Retell webhook pipeline that handles inbound calls and post-call events, (2) the Supabase multi-tenant database schema for calls, transcripts, recordings, and tenants, and (3) the translation layer that gates all user-facing strings so no English-only content is hardcoded from the start.

Retell operates via two distinct webhook channels: an **inbound call webhook** (`call_inbound` event) fired before the call connects — where you can dynamically configure the agent per caller — and a **post-call event webhook** series (`call_ended`, `call_analyzed`) fired after the call ends with the full recording URL, transcript, and analysis. The critical implementation insight is that `call_analyzed` — not `call_ended` — delivers the complete data set including the recording URL and structured transcript; plan storage writes to fire on `call_analyzed`.

The i18n decision favors `next-intl` 4.8.3 over `i18next`/`next-i18next`. It integrates natively with Next.js App Router server components via `getTranslations()`, has no TypeScript requirement, and is smaller than the i18next ecosystem. The language abstraction layer must be established in Wave 0 of this phase so that all subsequent prompt strings, notification templates, and UI strings route through translation keys from the outset.

**Primary recommendation:** Use Retell SDK 5.9.0 for webhook verification and API calls; trigger storage writes on `call_analyzed` (not `call_ended`); use `next-intl` for the translation layer; design the Supabase schema in Wave 0 so all later phases extend it rather than migrate it.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| retell-sdk | 5.9.0 | Retell API client + webhook verification | Official SDK, full JS support, built-in `Retell.verify()` for signature validation, published 2026-03-13 |
| @supabase/supabase-js | 2.99.2 | Supabase DB, Storage, Auth client | Official client, published 2026-03-17 |
| next-intl | 4.8.3 | Translation layer, i18n routing | Designed for App Router, works with server components, no TypeScript required, published 2026-02-16 |
| next | 16.1.7 | Full-stack framework (API routes + React) | Locked decision |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| retell-client-js-sdk | (latest) | Browser-side Retell web call integration | Only needed if adding web call interface — not Phase 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-intl | i18next + next-i18next | i18next is larger (~1.5x bundle), more config overhead, Pages Router focused; next-intl is the App Router standard |
| next-intl | react-intl (FormatJS) | FormatJS works but lacks Next.js-specific hooks and server component integration |
| Supabase Storage | S3 / Cloudflare R2 | More ops overhead; Supabase Storage is native and already in the locked stack |

**Installation:**

```bash
npm install retell-sdk @supabase/supabase-js next-intl
```

**Version verification:** Verified 2026-03-18 against npm registry:
- `retell-sdk@5.9.0` — published 2026-03-13
- `@supabase/supabase-js@2.99.2` — published 2026-03-17
- `next-intl@4.8.3` — published 2026-02-16
- `next@16.1.7` — published 2026-02-16

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── [locale]/                # next-intl locale segment
│   │   └── layout.js            # Locale provider
│   └── api/
│       ├── webhooks/
│       │   └── retell/
│       │       └── route.js     # POST — handles all Retell webhook events
│       └── calls/
│           └── [callId]/
│               └── route.js     # GET — retrieve call data
├── lib/
│   ├── retell.js                # Retell SDK client singleton
│   ├── supabase.js              # Supabase client (server-side, service role)
│   └── supabase-browser.js     # Supabase client (browser, anon key)
├── i18n/
│   ├── routing.js               # next-intl defineRouting config
│   └── request.js               # next-intl getRequestConfig
└── messages/
    ├── en.json                  # English translation keys
    └── es.json                  # Spanish translation keys
```

### Pattern 1: Retell Two-Webhook Architecture

**What:** Retell fires two distinct webhook types — inbound (before call connects) and post-call events (after call ends). These are separate endpoints with separate purposes.

**Inbound webhook (`call_inbound`)** — fires when a call arrives at your Retell number *before* the call connects. You have 10 seconds to respond with dynamic agent configuration. This is where you look up the tenant by phone number and inject dynamic variables (e.g., business name) into the agent for the call.

**Post-call webhooks (`call_ended`, `call_analyzed`)** — fire after the call ends. `call_ended` arrives first (without recording). `call_analyzed` arrives after analysis completes and includes `recording_url`, `transcript`, and `transcript_object`. Write storage and transcript records on `call_analyzed`.

**When to use:** Always. These are the two required integration points.

**Example — Inbound webhook handler:**

```javascript
// Source: https://docs.retellai.com/features/inbound-call-webhook
// src/app/api/webhooks/retell/route.js

import Retell from 'retell-sdk';

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-retell-signature');

  // Verify signature using official SDK
  const isValid = Retell.verify(rawBody, process.env.RETELL_API_KEY, signature);
  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const { event } = payload;

  if (event === 'call_inbound') {
    return handleInbound(payload);
  }
  if (event === 'call_ended') {
    // Acknowledge immediately; recording not yet available
    handleCallEnded(payload); // fire-and-forget for lightweight DB writes
    return Response.json({ received: true });
  }
  if (event === 'call_analyzed') {
    // Full data available: recording_url, transcript, transcript_object
    handleCallAnalyzed(payload); // fire-and-forget
    return Response.json({ received: true });
  }

  return Response.json({ received: true });
}

async function handleInbound(payload) {
  const { from_number, to_number } = payload;
  // Look up tenant by to_number
  // Return dynamic variables to personalize the call
  return Response.json({
    dynamic_variables: {
      business_name: 'HomeService Pro', // fetched from DB
      caller_history: 'new_caller',
    },
    // Override agent if needed per-tenant
  });
}
```

### Pattern 2: Recording Storage via call_analyzed

**What:** When Retell fires `call_analyzed`, fetch the audio from `recording_url`, upload to Supabase Storage, then write the storage path and transcript data to the database.

**When to use:** Always. Do not attempt to store recordings on `call_ended` — the URL may not be available yet.

**Example:**

```javascript
// Source: https://supabase.com/docs/reference/javascript/storage-from-upload
async function handleCallAnalyzed(payload) {
  const { call } = payload;
  const { call_id, recording_url, transcript, transcript_object } = call;

  // 1. Fetch audio from Retell
  const audioResponse = await fetch(recording_url);
  const audioBuffer = await audioResponse.arrayBuffer();

  // 2. Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('call-recordings')
    .upload(`${call_id}.wav`, audioBuffer, {
      contentType: 'audio/wav',
      upsert: false,
    });

  // 3. Store transcript and storage path in DB
  await supabase.from('calls').update({
    recording_storage_path: data.path,
    transcript_text: transcript,
    transcript_structured: transcript_object, // JSONB column
    status: 'analyzed',
  }).eq('retell_call_id', call_id);
}
```

### Pattern 3: Translation Layer with next-intl

**What:** All user-facing strings — system prompts, greeting templates, notification copy, validation messages — are accessed via translation keys. No literal English strings in application logic.

**When to use:** From Wave 0. Every new string must go through `t('key')` — never inline English literals.

**Example — Server component and route handler:**

```javascript
// Source: https://next-intl.dev/docs/environments/actions-metadata-route-handlers
// In server components:
import { getTranslations } from 'next-intl/server';

export default async function GreetingPage({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'agent' });
  return <p>{t('default_greeting')}</p>;
}

// In API routes / without locale routing — read locale from DB/cookie:
const t = await getTranslations({ locale: tenantLocale, namespace: 'agent' });
const greeting = t('default_greeting');
// → "Hello, thank you for calling. How can I help you today?"
//   or "Hola, gracias por llamar. ¿Cómo puedo ayudarle hoy?"
```

```json
// messages/en.json
{
  "agent": {
    "default_greeting": "Hello, thank you for calling. How can I help you today?",
    "recording_disclosure": "This call may be recorded for quality purposes.",
    "language_clarification": "Would you prefer English or Spanish?",
    "unsupported_language_apology": "I'm sorry, I am still learning {language}. Let me get someone to help you.",
    "call_wrap_up": "I want to make sure I've captured everything you need. Let me summarize before we finish.",
    "transfer_attempt": "Let me transfer you to the team now."
  }
}
```

```json
// messages/es.json
{
  "agent": {
    "default_greeting": "Hola, gracias por llamar. ¿Cómo puedo ayudarle hoy?",
    "recording_disclosure": "Esta llamada puede ser grabada por motivos de calidad.",
    "language_clarification": "¿Prefiere inglés o español?",
    "unsupported_language_apology": "Lo siento, todavía estoy aprendiendo {language}. Déjame conseguirle ayuda.",
    "call_wrap_up": "Quiero asegurarme de haberle atendido correctamente. Permítame resumir antes de finalizar.",
    "transfer_attempt": "Le voy a transferir al equipo ahora."
  }
}
```

### Pattern 4: Retell Multilingual Agent Prompt

**What:** Retell's language setting controls STT accent and TTS pronunciation, but **does not enforce LLM response language**. The system prompt must explicitly instruct the LLM to mirror the caller's language. Set the agent language to "multilingual" to enable auto-detection.

**Example system prompt segment:**

```
LANGUAGE INSTRUCTIONS:
- Detect the language of the caller's first utterance.
- Respond exclusively in the language the caller used in their most recent turn.
- If you are uncertain which language the caller prefers, ask: "Would you prefer English or Spanish? / ¿Prefiere inglés o español?"
- If the caller switches language mid-conversation, immediately switch your responses to match.
- If the caller speaks a language other than English or Spanish, respond with:
  "I'm sorry, I am still learning [detected language]. Let me get someone to help you."
  Then end the call gracefully.

CALL DURATION:
- After 9 minutes of conversation, begin wrapping up: "I want to make sure I've captured everything..."
- Do not allow calls to exceed 10 minutes.

RECORDING NOTICE:
- State at the start of every call: "[recording_disclosure]"
```

### Anti-Patterns to Avoid

- **Writing strings directly in prompts:** Never hardcode "Hello, thank you for calling" in the agent config. Always use a translation key, even for the initial agent prompt, so Spanish can be supported without a code change.
- **Storing recordings on `call_ended`:** The `recording_url` may not be populated yet. Always wait for `call_analyzed`.
- **Synchronous heavy processing in webhook handler:** Retell's webhook has a 10-second timeout and retries up to 3 times. Acknowledge with 200 immediately, then process storage writes asynchronously (use `after()` from Next.js or a background job pattern).
- **Using service_role key in client-side code:** Service role bypasses RLS. Keep it server-side only (API routes, server components).
- **Missing idempotency on webhook processing:** Retell retries on failure. Use the `call_id` as a dedupe key — upsert, not insert.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC implementation | `Retell.verify()` from retell-sdk | SDK handles timing-safe comparison correctly |
| Speech-to-text + TTS | Custom STT/TTS pipeline | Retell platform (built-in) | Retell handles STT, TTS, interruption handling, latency — hand-rolling takes months |
| Language detection | Custom ML model or langdetect library | Retell multilingual mode | Retell detects language from first utterance in real time, per-word timestamps included |
| Translation string management | Custom JSON loader + key resolver | next-intl | Handles namespaces, interpolation, pluralization, server/client component split, missing key warnings |
| Audio file streaming from Retell | Custom streaming proxy | fetch + Supabase Storage upload | Retell provides signed recording URLs; fetch → upload to Supabase is the standard pattern |
| Row-level access control | Custom `WHERE tenant_id = ?` in every query | Supabase RLS policies | RLS enforces at DB level regardless of query path; one missed `WHERE` clause cannot expose data |

**Key insight:** Retell is doing the hard work — STT, TTS, interruption detection, language detection, and call infrastructure. The application layer's job is webhook handling, data persistence, and prompt design. Don't reimplement what Retell already provides.

---

## Common Pitfalls

### Pitfall 1: Processing Heavy Work in the Webhook Handler Synchronously

**What goes wrong:** Fetching a recording URL, downloading audio, uploading to Supabase Storage, and writing to the database all happen inline in the webhook handler. If this takes more than 10 seconds, Retell retries, causing duplicate writes and race conditions.

**Why it happens:** The natural instinct is to do all processing in the handler before returning 200.

**How to avoid:** Return 200 immediately after signature verification and event routing. Use Next.js `after()` (available in Next.js 15+) to defer heavy work until after the response is sent. Alternatively, separate lightweight writes (create call record) from heavy writes (store recording) using the two-webhook pattern: create the call record on `call_ended`, enrich it with recording/transcript on `call_analyzed`.

**Warning signs:** Retell logs showing repeated webhook delivery for the same `call_id`. Duplicate call records in the database.

### Pitfall 2: Relying on `call_ended` for Recording URLs

**What goes wrong:** Code reads `recording_url` from the `call_ended` payload and gets `null` or an empty string.

**Why it happens:** `call_ended` fires immediately when the call disconnects — before Retell has finished processing and encoding the recording. The recording URL is only populated in `call_analyzed`, which fires after analysis completes.

**How to avoid:** Gate all recording storage writes on the `call_analyzed` event. Log `call_ended` for call status tracking only.

**Warning signs:** `recording_url` is consistently null/undefined despite recordings being enabled.

### Pitfall 3: Language Detection Without Prompt Enforcement

**What goes wrong:** Developer sets Retell's language to "multilingual" but the LLM still responds in English to Spanish callers.

**Why it happens:** Retell's language setting controls STT and TTS only. The LLM response language is controlled entirely by the system prompt. Without explicit instructions to mirror the caller's language, the LLM defaults to the language the prompt was written in.

**How to avoid:** Always include explicit language-mirroring instructions in the system prompt. Test with a Spanish utterance immediately.

**Warning signs:** STT transcription includes Spanish, but agent responses are in English.

### Pitfall 4: Missing RLS Tenant Isolation

**What goes wrong:** A bug in an API route causes one tenant's calls to be visible to another tenant's dashboard.

**Why it happens:** Relying solely on application-level `WHERE tenant_id = ?` clauses. A missing WHERE clause or a direct Supabase query without tenant context exposes all rows.

**How to avoid:** Enable RLS on every table from the start. Define policies that enforce `tenant_id = auth.uid()` or use a custom JWT claim for tenant context. Test policies using the Supabase client (not the SQL Editor, which bypasses RLS).

**Warning signs:** Queries that should be scoped to one tenant return rows from all tenants.

### Pitfall 5: Hardcoded English Strings in Prompts

**What goes wrong:** The Retell agent prompt contains literal English phrases. Adding Spanish support in Phase 5 requires modifying agent configs across all tenants.

**Why it happens:** Prompts are often written ad-hoc during development.

**How to avoid:** All prompt templates (greeting, recording disclosure, wrap-up, transfer announcement) must use translation keys resolved at agent initialization time. The translation layer must be established in Wave 0 before any prompt strings are written.

**Warning signs:** Any string in the codebase that reads "Hello, thank you for calling" or similar that is not a translated value.

### Pitfall 6: Vercel Hobby Tier 10-Second Timeout on Webhook Route

**What goes wrong:** On the Hobby plan, Vercel serverless functions time out after 10 seconds. A webhook handler that downloads audio and uploads to Supabase will exceed this.

**Why it happens:** Vercel Hobby limits serverless function duration to 10 seconds.

**How to avoid:** Return 200 immediately after verification. Use Next.js `after()` for background work. On Pro tier, function timeout extends to 60 seconds. Use the two-event pattern: acknowledge both events quickly and process storage separately.

**Warning signs:** Vercel function logs show 504 timeout errors on the webhook route.

---

## Code Examples

### Initialize Retell SDK

```javascript
// Source: https://docs.retellai.com/get-started/sdk
// src/lib/retell.js
import Retell from 'retell-sdk';

export const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
```

### Supabase Server Client (Service Role — API Routes Only)

```javascript
// Source: https://supabase.com/docs/reference/javascript/storage-from-upload
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Never expose to client
);
```

### next-intl Request Config (Cookie-Based Locale — No URL Routing)

```javascript
// Source: https://next-intl.dev/docs/usage/configuration
// src/i18n/request.js
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'en';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

### Supabase RLS Policy for Tenant Isolation

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Apply to every table in the schema

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_own_calls" ON calls
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### Webhook Handler with Immediate Response + Deferred Processing

```javascript
// Source: Retell docs + Next.js after() API
// src/app/api/webhooks/retell/route.js
import { after } from 'next/server';
import Retell from 'retell-sdk';
import { processCallAnalyzed } from '@/lib/call-processor';

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-retell-signature');

  if (!Retell.verify(rawBody, process.env.RETELL_API_KEY, signature)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event === 'call_analyzed') {
    // Defer heavy work — return 200 immediately
    after(async () => {
      await processCallAnalyzed(payload.call);
    });
  }

  return Response.json({ received: true }); // Must return 2xx within 10s
}
```

---

## Proposed Database Schema

This schema is designed for Phase 1 and extended in later phases. Column names and types are chosen to match Retell's payload field names directly to reduce mapping errors.

```sql
-- Tenants table (one row per business account)
CREATE TABLE tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  business_name   text,
  retell_phone_number text UNIQUE, -- phone number registered in Retell
  default_locale  text NOT NULL DEFAULT 'en', -- 'en' | 'es'
  onboarding_complete boolean NOT NULL DEFAULT false
);

-- Calls table (one row per Retell call)
CREATE TABLE calls (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  retell_call_id        text UNIQUE NOT NULL, -- dedupe key
  created_at            timestamptz NOT NULL DEFAULT now(),
  from_number           text,
  to_number             text,
  direction             text, -- 'inbound' | 'outbound'
  status                text NOT NULL DEFAULT 'started', -- 'started'|'ended'|'analyzed'
  disconnection_reason  text,
  start_timestamp       bigint,
  end_timestamp         bigint,
  duration_seconds      int GENERATED ALWAYS AS (
    CASE WHEN end_timestamp IS NOT NULL AND start_timestamp IS NOT NULL
    THEN ((end_timestamp - start_timestamp) / 1000)::int
    ELSE NULL END
  ) STORED,
  -- Recording
  recording_url         text, -- Retell's URL (may expire)
  recording_storage_path text, -- path in Supabase Storage (permanent)
  -- Transcripts (both formats per decision)
  transcript_text       text, -- plain text for display
  transcript_structured jsonb, -- array of utterance objects with timestamps
  -- Language
  detected_language     text, -- 'en' | 'es' | 'zh' | etc.
  -- Metadata
  retell_metadata       jsonb -- raw metadata from Retell
);

CREATE INDEX idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX idx_calls_from_number ON calls(tenant_id, from_number);
CREATE INDEX idx_calls_retell_call_id ON calls(retell_call_id);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- RLS policies (tenant isolation via JWT claim)
CREATE POLICY "tenants_own_calls" ON calls
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

**Supabase Storage Buckets:**

```
call-recordings/     — private bucket, recordings stored as {call_id}.wav
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-i18next` for Pages Router | `next-intl` for App Router | Next.js 13 App Router (2023) | next-intl designed specifically for RSC; i18next patterns become complex |
| Custom HMAC verification | `Retell.verify()` from SDK | retell-sdk v4+ | No hand-rolled crypto needed |
| Custom LLM WebSocket for advanced features | Retell built-in LLM with system prompt | Retell 2024 platform maturity | Built-in LLM is recommended unless you have compliance requirements |
| i18next browser-side loading | next-intl server-side `getTranslations()` | App Router adoption | Translations load server-side, no hydration mismatch, no bundle bloat |

**Deprecated/outdated:**
- `next-i18next`: Pages Router era, not recommended for App Router projects — use `next-intl` instead
- Custom LLM WebSocket: Only for compliance/custom LLM needs — Retell built-in LLM is preferred
- Reading `recording_url` from `call_ended`: Not available yet — always wait for `call_analyzed`

---

## Open Questions

1. **Retell Voice ID for warm professional persona**
   - What we know: ElevenLabs and OpenAI voices are available; Retell recommends GPT-4.1 for LLM; dynamic voice speed adjustment is available
   - What's unclear: The specific voice ID names available in the Retell dashboard as of March 2026 require live account access to enumerate
   - Recommendation: During Wave 1 (agent setup), use the Retell dashboard to audition voices and select one with warm, professional tone. ElevenLabs "Rachel" or similar professional female voice is a common baseline. Document the chosen voice ID in the codebase as `RETELL_VOICE_ID` env var.

2. **`call_analyzed` timing relative to `call_ended`**
   - What we know: `call_analyzed` fires after analysis completes; it includes recording URL and call analysis object
   - What's unclear: The typical delay between `call_ended` and `call_analyzed` is not documented in official docs — could be seconds or minutes for longer calls
   - Recommendation: Treat recording as eventually consistent. Do not block any call summary API on recording availability. Show a "Processing..." state for the recording player until `recording_storage_path` is populated.

3. **Inbound webhook response timing for sub-1-second answer**
   - What we know: The inbound webhook fires before the call connects, with 10-second timeout; if the webhook doesn't respond, the call stays in ringing state
   - What's unclear: Whether the 1-second answer guarantee is impacted by cold-start latency on Vercel serverless functions for the inbound webhook route
   - Recommendation: The inbound webhook handler must be as lightweight as possible (single DB lookup by phone number). Use Vercel Pro to configure the function for a specific region closest to the Retell infrastructure. Consider a pre-warmed pattern or edge function for the inbound route if cold starts become an issue.

4. **next-intl without locale-based URL routing**
   - What we know: next-intl supports cookie-based locale without URL routing (no `/en/` or `/es/` prefix required)
   - What's unclear: Whether agent-side prompt strings (served via API, not UI) are cleanly handled by next-intl's route handler pattern
   - Recommendation: Use the `getTranslations({ locale, namespace })` pattern for API routes. This works without URL routing. Store tenant locale in the `tenants.default_locale` column and pass it explicitly.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (JavaScript, no TypeScript) |
| Config file | `jest.config.js` — Wave 0 gap |
| Quick run command | `npx jest --testPathPattern=webhooks --passWithNoTests` |
| Full suite command | `npx jest --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | Inbound webhook returns 2xx within 10s | Integration (mock Retell) | `npx jest tests/webhooks/retell-inbound.test.js -x` | Wave 0 |
| VOICE-01 | Invalid signature returns 401 | Unit | `npx jest tests/webhooks/retell-signature.test.js -x` | Wave 0 |
| VOICE-05 | System prompt contains language-mirroring instructions | Unit (prompt content assertion) | `npx jest tests/agent/prompt.test.js -x` | Wave 0 |
| VOICE-06 | Code-switching prompt instructions present | Unit (prompt content assertion) | `npx jest tests/agent/prompt.test.js -x` | Wave 0 |
| VOICE-08 | call_analyzed handler uploads recording to Supabase Storage | Integration (Supabase mock) | `npx jest tests/webhooks/call-analyzed.test.js -x` | Wave 0 |
| VOICE-09 | Transcript plain text and structured JSONB both written to DB | Integration (Supabase mock) | `npx jest tests/webhooks/call-analyzed.test.js -x` | Wave 0 |
| All | Translation keys present in en.json and es.json | Unit (key coverage) | `npx jest tests/i18n/translation-keys.test.js -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx jest --passWithNoTests` (fast unit tests only, < 10s)
- **Per wave merge:** `npx jest --passWithNoTests` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `jest.config.js` — framework config, `npm install --save-dev jest @jest/globals`
- [ ] `tests/webhooks/retell-inbound.test.js` — REQ VOICE-01, covers inbound call routing and 2xx response
- [ ] `tests/webhooks/retell-signature.test.js` — REQ VOICE-01, covers signature rejection
- [ ] `tests/webhooks/call-analyzed.test.js` — REQ VOICE-08, VOICE-09, covers storage upload + transcript write
- [ ] `tests/agent/prompt.test.js` — REQ VOICE-05, VOICE-06, asserts language instructions in system prompt
- [ ] `tests/i18n/translation-keys.test.js` — all REQs, asserts en.json and es.json key parity
- [ ] `tests/__mocks__/supabase.js` — shared mock for Supabase client

---

## Sources

### Primary (HIGH confidence)

- Retell SDK npm registry — `retell-sdk@5.9.0`, published 2026-03-13, verified via `npm view`
- [Retell Webhook Overview](https://docs.retellai.com/features/webhook-overview) — event types, payload schemas, verification method, call_analyzed vs call_ended distinction
- [Retell Inbound Call Webhook](https://docs.retellai.com/features/inbound-call-webhook) — inbound event schema, dynamic variable injection, 10-second timeout
- [Retell Get Call API](https://docs.retellai.com/api-references/get-call) — full call object schema: recording_url, transcript, transcript_object, call_analysis
- [Retell Agent Language](https://docs.retellai.com/agent/language) — multilingual mode, auto-detection behavior, prompt language enforcement requirement
- [Supabase JavaScript Storage Upload](https://supabase.com/docs/reference/javascript/storage-from-upload) — upload API, content type handling
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) — policy syntax, WITH CHECK clause
- [next-intl App Router Getting Started](https://next-intl.dev/docs/getting-started/app-router) — installation, locale routing, server component usage
- [next-intl Server Actions & Route Handlers](https://next-intl.dev/docs/environments/actions-metadata-route-handlers) — `getTranslations({ locale, namespace })` for API routes
- npm registry — `@supabase/supabase-js@2.99.2`, `next-intl@4.8.3`, `next@16.1.7` — versions verified 2026-03-18

### Secondary (MEDIUM confidence)

- [Retell AI Multilingual Blog Post](https://www.retellai.com/blog/how-to-use-ai-phone-agents-for-multilingual-communication) — 10 auto-detected languages including English, Spanish; 31+ TTS languages
- [Vercel Function Duration Docs](https://vercel.com/docs/functions/configuring-functions/duration) — 10s Hobby limit, 60s Pro limit
- [Supabase Multi-Tenant RLS Pattern](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — tenant_id column + JWT claim pattern
- [Dev.to: Building Multilingual Agents with Retell AI](https://dev.to/callstacktech/building-multilingual-agents-with-retell-ai-sdks-for-accent-adaptation) — language hint injection pattern, 200ms buffer approach

### Tertiary (LOW confidence — flag for validation)

- Retell GPT-4.1 recommendation for "optimal balance of response quality, latency, cost-effectiveness" — from Retell's own configuration docs, but LLM pricing/quality is fast-moving
- Specific voice IDs available in Retell ElevenLabs integration — requires live account access to enumerate current options

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against live npm registry 2026-03-18
- Architecture: HIGH — webhook schemas verified against official Retell docs, Supabase patterns from official docs
- Pitfalls: HIGH — recording URL timing and webhook timeout verified from official Retell docs; language prompt enforcement verified from official Retell language guide
- Schema design: MEDIUM — follows Supabase RLS best practices from official docs; specific column choices are Claude's discretion per CONTEXT.md

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (retell-sdk and Supabase release frequently; re-verify package versions before implementation)
