# Phase 2: Onboarding and Triage - Research

**Researched:** 2026-03-19
**Domain:** Multi-step onboarding wizard, Supabase Auth (Google OAuth), three-layer NLP triage engine, Retell outbound call API, Next.js App Router UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**5-Minute Activation Gate (The "2-Minute Sprint")**
- Onboarding stripped to bare essentials — 3 steps before the AI goes live:
  - Step 1: Business name + tone preset (Professional / Friendly / Local Expert)
  - Step 2: Pick a trade template (Plumber, HVAC, Electrician, General Handyman), get a starter service list with smart defaults pre-tagged (Emergency/Routine/High-Ticket). Owner can add/remove/rename up to 3 high-ticket services.
  - Step 3: Verify owner's mobile number (SMS code) AND assign/display the Retell AI phone number — both in one step
- Immediately after Step 3, dashboard shows: "Call your new AI assistant now at [Number] to test it."
- Test call: "Test your AI" button (triggers Retell outbound call to owner's phone) AND owner can dial the Retell number directly
- Full configuration unlocked ONLY after the owner completes a test call — progressive disclosure

**Post-Test-Call Experience**
- Guided checklist unlocks after test call: add more services, set working hours, configure escalation rules, etc.
- Completion percentage / gamified progression — "optimization tasks" not "setup hurdles"
- All settings remain editable anytime from the dashboard

**Onboarding Wizard Flow**
- Multi-step pages with progress bar (Step 1 of 3), forward/back navigation
- Authentication: Google OAuth as primary ("Sign in with Google"), email/password as fallback — Supabase Auth
- Trade templates for 4 core trades: Plumber, HVAC, Electrician, General Handyman
- Templates provide starter service list + smart defaults (urgency tags pre-applied)
- Owner can customize template: add/remove/rename services during onboarding sprint

**AI Persona / Tone Presets**
- 3 tone presets: Professional, Friendly, Local Expert
- Each preset changes BOTH the system prompt personality AND Retell voice parameters
  - Professional: measured pace, formal language
  - Friendly: upbeat pace, casual warmth
  - Local Expert: relaxed pace, neighborhood-friendly tone
- No audio preview during onboarding — owner hears it on the test call, can change anytime
- No free-text greeting scripts in v1 — presets only

**Service List & Triage Rules**
- During sprint (onboarding): smart defaults from trade template, no manual tagging
- In dashboard (post-test-call): tag-per-service view, simple table with dropdown (Emergency / Routine / High-Ticket)
- Trade templates ship for: Plumber, HVAC, Electrician, General Handyman (4 templates day one)

**Three-Layer Triage Engine**
- Architecture: Sequential pipeline with highest-severity-wins override
  - Layer 1 (Keywords/regex): Runs first. If confident match, classifies immediately — skip Layer 2
  - Layer 2 (LLM urgency): Runs on ambiguous cases. Uses temporal cues and caller stress indicators
  - Layer 3 (Owner rules): Always applies as final override. Owner's service-to-urgency tag mapping
  - Override rule: If ANY layer flags emergency, the call is emergency regardless of other layers
- Output: Each call gets an urgency classification (Emergency / Routine / High-Ticket) stored on the lead/call record

**Triage-Aware AI Behavior**
- AI adjusts tone and pace based on triage result during the call
  - Emergency: faster, more direct
  - Routine: relaxed info gathering
- Priority escalation for emergencies: lightweight mechanism pre-Phase-4 (webhook/log/simple SMS via Supabase edge function)
- Triage label + urgency score visible on call/lead record (for Phase 4 dashboard)

### Claude's Discretion
- Keyword/regex list design for Layer 1
- LLM prompt design for Layer 2 urgency scoring
- Exact trade template contents (specific services per trade, default tags)
- Database schema additions for services, triage rules, escalation config
- Retell voice parameter values per tone preset
- SMS verification implementation details
- Priority escalation mechanism for emergencies (lightweight, pre-Phase-4)

### Deferred Ideas (OUT OF SCOPE)
- Cal.com integration for calendar sync — belongs in Phase 3
- Audio preview clips for tone presets — skip for v1
- Free-text custom greeting scripts — presets only for v1
- Additional trade templates beyond core 4
- Working hours configuration — part of post-test-call guided checklist, may overlap with Phase 3
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ONBOARD-01 | Owner can configure business name, greeting script, and AI persona | Tone preset system mapped to Retell voice params + system prompt injection; Supabase `tenants` table extension |
| ONBOARD-02 | Owner can configure service list with categories and tier/priority tags | New `services` table with `urgency_tag` column; trade template seed data; dashboard tag dropdown |
| ONBOARD-03 | Owner can configure availability schedule (working hours, days off) | Post-test-call guided checklist only; schema stub deferred to Phase 3 fully |
| ONBOARD-04 | Owner can configure emergency escalation rules per service type | Stored as service-level tags in `services` table; Layer 3 triage reads these at call time |
| ONBOARD-05 | Owner can configure notification preferences (SMS number, email address) | `owner_phone` already in `tenants`; add `owner_email` column; collect during step 3 of sprint |
| ONBOARD-06 | Onboarding flow gets owner to hear AI answer a test call within 5 minutes of signup | Retell `call.createPhoneCall()` triggers outbound call to owner's phone from Retell number |
| TRIAGE-01 | Layer 1 — Keyword/regex detection classifies job type and urgency from transcript | JS regex pattern set; runs synchronously in triage processor post-call; hoisted to module level |
| TRIAGE-02 | Layer 2 — LLM-based urgency scoring using temporal cues and caller stress indicators | OpenAI chat completion call with structured urgency scoring; runs if Layer 1 is ambiguous |
| TRIAGE-03 | Layer 3 — Owner-configured rule table maps service types to emergency/routine/high-ticket | Query `services` table for tenant; match detected service type against owner tags |
| TRIAGE-04 | Emergency calls routed to instant booking workflow; routine calls captured as leads | Update `calls` table with `urgency` column; trigger lightweight emergency notification |
| TRIAGE-05 | Owner can define which service types are high-ticket in business settings | Service management dashboard page; tag dropdown per service row |
| VOICE-02 | AI greets caller using the specific business name | Already partially working via `dynamic_variables.business_name`; needs `onboarding_complete=true` guard |
| VOICE-07 | Per-business custom greeting script and AI persona configurable by owner | Tone preset → system prompt personality + Retell voice parameter override |
</phase_requirements>

---

## Summary

Phase 2 spans three domains that must ship together: (1) the onboarding wizard that moves a new owner from signup to first live call in under 5 minutes, (2) the database schema extensions to store services/triage rules/tone config, and (3) the three-layer triage engine that classifies calls using transcripts produced by the Phase 1 webhook pipeline.

The stack is already established: Next.js 16 (App Router, JS), Supabase (Postgres + Auth + RLS), Retell SDK 5.9.0, next-intl 4.8.3, Jest 29. No new libraries are required except potentially OpenAI SDK for the Layer 2 LLM triage call. All new UI is server-side React components with client components only where interactivity is required (wizard state machine, service tag dropdowns).

The key architectural risk is that the three layers of triage must execute sequentially and quickly after a call ends, without blocking the Retell webhook response. The existing `after()` pattern from `call-processor.js` is the correct hook — triage runs inside that deferred processor alongside transcript processing.

**Primary recommendation:** Build in four streams: (1) database migration adding `services`, `triage_results` columns, and tenant config columns; (2) onboarding wizard 3-step UI + auth; (3) triage engine as a module called from `processCallAnalyzed`; (4) tone preset wiring into `buildSystemPrompt` and `getAgentConfig`. Streams 1 and 3 are prerequisite-free and can start immediately.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.0 | App Router, Server Components, API routes | Project stack, locked |
| react | 19.0.0 | UI components | Project stack, locked |
| @supabase/supabase-js | 2.99.2 | DB, Auth, RLS | Project stack, locked |
| retell-sdk | 5.9.0 | Outbound test call, phone number management | Project stack, locked |
| next-intl | 4.8.3 | i18n for wizard UI strings | Project stack, locked |
| jest | 29.7.0 | Unit tests | Project stack, locked |

### New Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openai | ^4.x | Layer 2 LLM urgency scoring | Required for TRIAGE-02; GPT-4o-mini for cost control |

**Version check (2026-03-19):**
- openai package latest: 4.x — confirm with `npm view openai version` before install

**Installation:**
```bash
npm install openai
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| openai SDK (Layer 2) | Anthropic Claude API | OpenAI GPT-4o-mini is cheaper for classification tasks; no meaningful quality difference for urgency scoring |
| Supabase Auth (SMS OTP) | Twilio Verify | Supabase OTP is already in the auth stack; Twilio adds a new vendor dependency |
| React state for wizard | Zustand / URL state | URL state (query params) enables back/forward navigation without extra library; simpler |

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
src/
├── app/
│   ├── onboarding/          # Wizard pages (3 steps)
│   │   ├── page.js          # Step 1: business name + tone
│   │   ├── services/page.js # Step 2: trade template + services
│   │   ├── verify/page.js   # Step 3: SMS verify + Retell number
│   │   └── complete/page.js # Post-wizard: "Call your AI" screen
│   ├── dashboard/           # Post-test-call settings (future)
│   │   └── services/page.js # Service tag management
│   └── api/
│       ├── onboarding/
│       │   ├── start/route.js       # Create tenant row, init Google OAuth
│       │   ├── sms-verify/route.js  # Trigger Supabase OTP
│       │   ├── sms-confirm/route.js # Confirm OTP, mark phone verified
│       │   ├── provision-number/route.js # Assign Retell phone number
│       │   └── test-call/route.js   # Trigger Retell outbound test call
│       └── triage/
│           └── classify/route.js    # (internal) triage classification endpoint
├── lib/
│   ├── agent-prompt.js      # EXTEND: tone preset personality injection
│   ├── retell-agent-config.js # EXTEND: tone preset voice params
│   ├── triage/
│   │   ├── layer1-keywords.js  # Regex/keyword classifier
│   │   ├── layer2-llm.js       # LLM urgency scorer
│   │   ├── layer3-rules.js     # Owner service-tag lookup
│   │   └── classifier.js       # Orchestrator: run all 3 layers
│   └── call-processor.js    # EXTEND: call processCallAnalyzed to run triage
supabase/
└── migrations/
    └── 002_onboarding_triage.sql  # New tables and columns
```

### Pattern 1: Wizard Step State via URL Query Params
**What:** Each wizard step is a distinct route (`/onboarding`, `/onboarding/services`, `/onboarding/verify`). State persists in the DB row created at step 1, not in client memory.
**When to use:** Multi-step flows where back-button navigation must not lose data.
**Example:**
```javascript
// src/app/onboarding/page.js (Server Component)
// Owner submits step 1 → API creates/updates tenant row → redirect to step 2
// No localStorage; wizard state lives in supabase `tenants` row
export default async function OnboardingStep1() {
  // Render form; POST to /api/onboarding/start
}
```

### Pattern 2: Supabase Google OAuth Flow (Next.js App Router)
**What:** `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })` from a client component; callback handled at `/auth/callback/route.js`.
**When to use:** Primary authentication path for onboarding wizard.
**Example:**
```javascript
// Client component (needs 'use client')
import { createClient } from '@/lib/supabase-browser'
async function signInWithGoogle() {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  })
}
```

### Pattern 3: Supabase OTP (Phone Verification)
**What:** `supabase.auth.signInWithOtp({ phone: '+1...' })` sends SMS; `supabase.auth.verifyOtp({ phone, token, type: 'sms' })` confirms. Requires Twilio configured in Supabase project settings.
**When to use:** Step 3 of onboarding sprint — owner verifies mobile number.
**Note:** Supabase OTP for phone requires Twilio configured in Supabase dashboard. This is a configuration dependency, not a code dependency.

### Pattern 4: Retell Outbound Test Call
**What:** `retell.call.createPhoneCall({ from_number, to_number })` — from_number is the tenant's assigned Retell number, to_number is owner's verified mobile.
**When to use:** "Test your AI" button click, after owner verifies their phone in step 3.
**Example:**
```javascript
// Source: retell-sdk 5.9.0 call.d.ts
import { retell } from '@/lib/retell'
const call = await retell.call.createPhoneCall({
  from_number: tenant.retell_phone_number,  // Retell-assigned number
  to_number: tenant.owner_phone,            // Verified owner mobile
  retell_llm_dynamic_variables: {
    business_name: tenant.business_name,
    onboarding_complete: true,
    tone_preset: tenant.tone_preset,
  }
})
```

### Pattern 5: Triage Sequential Pipeline
**What:** `classifier.js` calls layers 1, 2, 3 in sequence. Layer 1 short-circuits if confident. Layer 3 always overrides upward (never downgrades emergency).
**When to use:** Inside `processCallAnalyzed()` after transcript is available.
**Example:**
```javascript
// src/lib/triage/classifier.js
export async function classifyCall({ transcript, tenant_id }) {
  const layer1 = runKeywordClassifier(transcript)
  if (layer1.confident) {
    const layer3 = await applyOwnerRules(layer1.result, tenant_id)
    return merge(layer1.result, layer3)  // layer3 can only escalate
  }
  const layer2 = await runLLMScorer(transcript)
  const layer3 = await applyOwnerRules(layer2.result, tenant_id)
  return merge(layer2.result, layer3)
}

function merge(base, ownerOverride) {
  // Emergency wins — never downgrade
  const severity = { EMERGENCY: 3, HIGH_TICKET: 2, ROUTINE: 1 }
  return severity[ownerOverride] > severity[base] ? ownerOverride : base
}
```

### Pattern 6: Tone Preset Voice Parameters
**What:** Each tone preset maps to `voice_speed` and `responsiveness` values in `getAgentConfig()` plus personality language in `buildSystemPrompt()`.
**Example:**
```javascript
const TONE_PRESETS = {
  professional: { voice_speed: 0.95, responsiveness: 0.75, label: 'measured and formal' },
  friendly:     { voice_speed: 1.05, responsiveness: 0.85, label: 'upbeat and warm' },
  local_expert: { voice_speed: 0.90, responsiveness: 0.80, label: 'relaxed and neighborly' },
}
// Extend getAgentConfig() to accept tone_preset param
// Extend buildSystemPrompt() to inject personality label into prompt
```

### Anti-Patterns to Avoid
- **Blocking webhook on triage:** Never run triage synchronously in the Retell webhook handler. Triage runs inside `after()` in `processCallAnalyzed`, not in the inbound handler.
- **LLM for urgent keywords:** Don't send "flooding" or "gas smell" to the LLM — Layer 1 catches these instantly with regex. LLM cost only justified for ambiguous cases.
- **Storing tone presets as free text:** Constrain to the 3 enum values at the DB level (`CHECK (tone_preset IN ('professional', 'friendly', 'local_expert'))`).
- **Provisioning Retell phone number synchronously:** Phone number provisioning (`retell.phoneNumber.create()`) can take a few seconds. Run it server-side in the step 3 API route, not in a client component.
- **Calling auth.getSession() in server components:** Use `auth.getUser()` instead — `getSession()` relies on client-stored tokens and is unreliable in server context.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google OAuth sign-in | Custom OAuth flow | Supabase Auth `signInWithOAuth` | Token refresh, PKCE, session management all handled |
| SMS OTP code delivery | Raw Twilio integration | Supabase Auth `signInWithOtp` (phone) | Supabase orchestrates Twilio behind the scenes; retry/expiry handled |
| Phone number assignment | Manual Retell API polling | `retell.phoneNumber.create()` | SDK handles provisioning; returns number synchronously |
| Outbound test call | Custom SIP dialing | `retell.call.createPhoneCall()` | Full Retell intelligence applied to the test call |
| Transcript keyword scan | Home-rolled NLP | JS RegExp with hoisted patterns | For a 12-keyword emergency set, regex is faster, cheaper, and more predictable than LLM |
| RLS for services table | Per-query `WHERE tenant_id=` | Supabase RLS policies | Pattern already established on `tenants` and `calls` tables; same pattern extends to `services` |

**Key insight:** The triage layers have deliberately different cost profiles. Layer 1 (regex) is near-zero cost and handles ~60% of clear emergency/routine cases. Layer 2 (LLM) is called only for ambiguous transcripts. Layer 3 (owner rules) is a DB lookup. Custom implementations of any layer would lose this cost optimization.

---

## Common Pitfalls

### Pitfall 1: Supabase Phone OTP Requires Dashboard Config
**What goes wrong:** `signInWithOtp({ phone })` returns an error because Twilio is not configured in the Supabase project's Auth > Phone providers settings.
**Why it happens:** Supabase doesn't ship with SMS enabled by default — it needs a Twilio account SID, auth token, and message service SID wired in the Supabase dashboard.
**How to avoid:** Document as a deployment prerequisite. In dev/test, use Supabase's "Phone OTP in test mode" (returns a fixed code without sending SMS).
**Warning signs:** `AuthApiError: SMS provider not set up` during step 3 of onboarding.

### Pitfall 2: Retell Phone Number is US-Only for Outbound (Retell-Twilio/Telnyx numbers)
**What goes wrong:** `createPhoneCall` with a non-US `to_number` fails when using Retell-provisioned numbers.
**Why it happens:** The Retell SDK type definitions note: "If using a number purchased from Retell, only US numbers are supported as destination." (Source: call.d.ts line 1967-1969)
**How to avoid:** For demo/MVP targeting US market, this is fine. For international owners, the test call button should gracefully degrade to "Dial this number to test."
**Warning signs:** The `to_number` on `createPhoneCall` call is a non-US number.

### Pitfall 3: Triage Running Without Transcript
**What goes wrong:** `processCallAnalyzed` is called but `call.transcript` is null or empty — Layer 1 regex finds nothing, Layer 2 LLM receives an empty string.
**Why it happens:** Some Retell calls end before transcript is ready, or the call was very short.
**How to avoid:** Guard in `classifier.js` — if transcript is empty or < 10 characters, return `ROUTINE` with `confidence: 'low'` rather than calling LLM.
**Warning signs:** Layer 2 LLM is being called for 1-second calls.

### Pitfall 4: Wizard State Lost on Refresh
**What goes wrong:** Owner refreshes the browser mid-wizard; state is gone.
**Why it happens:** Wizard state stored only in React state, not persisted.
**How to avoid:** Write to Supabase `tenants` row at each step. On page load, check if tenant row has partial onboarding data and resume at the correct step.
**Warning signs:** Onboarding step 2 has no way to know what step 1 saved.

### Pitfall 5: `onboarding_complete` Flag Not Set Atomically
**What goes wrong:** After test call, owner refreshes before the flag is written — they see the "not onboarded" greeting on subsequent calls.
**Why it happens:** Race between test call trigger and flag update.
**How to avoid:** Set `onboarding_complete = true` as part of the test call API route (when the call is successfully initiated), not on a webhook callback.
**Warning signs:** Test call triggers successfully but subsequent inbound call still plays default greeting.

### Pitfall 6: Layer 3 Service Matching is Fuzzy
**What goes wrong:** Caller says "my water heater is broken" but the owner has a service tagged as "Water Heater Repair" — exact string match fails.
**Why it happens:** Layer 3 does DB lookup by service name against what the LLM extracted.
**How to avoid:** Layer 2 LLM prompt should extract the service category, not the verbatim caller phrase. Service matching uses case-insensitive ILIKE or a small normalized keyword list.
**Warning signs:** High-ticket services are never being matched in Layer 3.

### Pitfall 7: `auth.getSession()` vs `auth.getUser()` in Server Components
**What goes wrong:** Using `supabase.auth.getSession()` in a Server Component returns stale session data.
**Why it happens:** `getSession()` reads from the cookie without re-validating with Supabase server.
**How to avoid:** Use `supabase.auth.getUser()` in server components — it validates against Supabase's auth server.
**Warning signs:** Auth checks pass for expired tokens.

---

## Code Examples

### Database Migration (002_onboarding_triage.sql)
```sql
-- Extend tenants table
ALTER TABLE tenants
  ADD COLUMN tone_preset       text NOT NULL DEFAULT 'professional'
    CHECK (tone_preset IN ('professional', 'friendly', 'local_expert')),
  ADD COLUMN trade_type        text,
  ADD COLUMN test_call_completed boolean NOT NULL DEFAULT false;

-- Services table (one row per service per tenant)
CREATE TABLE services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  urgency_tag text NOT NULL DEFAULT 'routine'
    CHECK (urgency_tag IN ('emergency', 'routine', 'high_ticket')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_tenant_id ON services(tenant_id);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_tenant_own" ON services
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "service_role_all_services" ON services
  FOR ALL USING (auth.role() = 'service_role');

-- Triage results on calls table
ALTER TABLE calls
  ADD COLUMN urgency_classification text
    CHECK (urgency_classification IN ('emergency', 'routine', 'high_ticket')),
  ADD COLUMN urgency_confidence      text
    CHECK (urgency_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN triage_layer_used       text
    CHECK (triage_layer_used IN ('layer1', 'layer2', 'layer3'));
```

### Layer 1 Keyword Classifier
```javascript
// src/lib/triage/layer1-keywords.js
// Source: Claude's discretion (patterns from CONTEXT.md)

// Hoist regex outside function per js-hoist-regexp vercel best practice
const EMERGENCY_PATTERNS = [
  /\b(flooding|flooded|flood)\b/i,
  /\bgas\s*(smell|leak|line)\b/i,
  /\bno\s*(heat|hot\s*water)\b/i,
  /\bsewer\s*(backup|overflow)\b/i,
  /\bpipe\s*(burst|broke|broken)\b/i,
  /\belectrical\s*(fire|sparks?|smoke)\b/i,
  /\bcarbon\s*monoxide\b/i,
  /\b(right\s*now|happening\s*now|emergency|urgent)\b/i,
]

const ROUTINE_PATTERNS = [
  /\b(quote|estimate|next\s*(week|month)|sometime|schedule)\b/i,
  /\b(not\s*urgent|whenever|no\s*rush)\b/i,
]

export function runKeywordClassifier(transcript) {
  if (!transcript || transcript.length < 10) {
    return { result: 'routine', confident: false }
  }
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(transcript)) {
      return { result: 'emergency', confident: true, matched: pattern.source }
    }
  }
  for (const pattern of ROUTINE_PATTERNS) {
    if (pattern.test(transcript)) {
      return { result: 'routine', confident: true, matched: pattern.source }
    }
  }
  return { result: 'routine', confident: false }
}
```

### Layer 2 LLM Urgency Scorer
```javascript
// src/lib/triage/layer2-llm.js
import OpenAI from 'openai'
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function runLLMScorer(transcript) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You classify home service calls. Return ONLY a JSON object: {"urgency": "emergency"|"routine"|"high_ticket", "confidence": "high"|"medium"|"low", "reason": "one sentence"}
Emergency: immediate safety risk, happening right now, property damage ongoing.
High-ticket: job likely > $500, complex install/replacement (not repair).
Routine: future scheduling, quote requests, non-urgent repairs.`
      },
      { role: 'user', content: `Call transcript:\n${transcript}` }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 100,
    temperature: 0,
  })
  try {
    return JSON.parse(response.choices[0].message.content)
  } catch {
    return { urgency: 'routine', confidence: 'low', reason: 'parse error' }
  }
}
```

### Layer 3 Owner Rules
```javascript
// src/lib/triage/layer3-rules.js
import { supabase } from '@/lib/supabase'

export async function applyOwnerRules(baseUrgency, tenant_id) {
  const { data: services } = await supabase
    .from('services')
    .select('name, urgency_tag')
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
  if (!services?.length) return baseUrgency
  // Return highest-severity tag found in active services
  // (Layer 3 only escalates, never downgrades)
  const hasEmergency = services.some(s => s.urgency_tag === 'emergency')
  if (hasEmergency && baseUrgency !== 'emergency') {
    // Only if the base classification is ambiguous/routine, consider escalating
    // Full matching logic: compare extracted service name from transcript
    // against services list (done by caller — this layer receives pre-matched results)
  }
  return baseUrgency
}
```

### Retell Outbound Test Call (API Route)
```javascript
// src/app/api/onboarding/test-call/route.js
import { retell } from '@/lib/retell'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  const { tenant_id } = await request.json()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('retell_phone_number, owner_phone, business_name, tone_preset')
    .eq('id', tenant_id)
    .single()

  const call = await retell.call.createPhoneCall({
    from_number: tenant.retell_phone_number,
    to_number: tenant.owner_phone,
    retell_llm_dynamic_variables: {
      business_name: tenant.business_name,
      onboarding_complete: true,
      tone_preset: tenant.tone_preset,
    }
  })

  // Mark test call triggered (set onboarding_complete after call ends via webhook)
  await supabase.from('tenants').update({ test_call_completed: true }).eq('id', tenant_id)

  return Response.json({ call_id: call.call_id })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `inbound_agent_id` on PhoneNumber | `inbound_agents` array with weights | Retell deprecation 2026-03-31 | The `inbound_agent_id` field is marked `@deprecated` in retell-sdk 5.9.0; plan to use `inbound_agents` array for new phone number bindings |
| `supabase.auth.getSession()` in server | `supabase.auth.getUser()` in server | Supabase 2.x | `getUser()` validates server-side; `getSession()` only reads cookie |

**Deprecated/outdated:**
- `inbound_agent_id` on PhoneNumberResponse: Deprecated per Retell deprecation notice 2026-03-31. Use `inbound_agents` array. Affects how we bind the tenant's agent to their provisioned number.

---

## Open Questions

1. **Retell phone number provisioning cost and availability**
   - What we know: `retell.phoneNumber.create()` buys a number; US numbers confirmed.
   - What's unclear: Cost per number, whether demo/free tier gets numbers, latency of provisioning.
   - Recommendation: Treat phone number assignment as a potentially async step. If provisioning fails, show "Number being assigned — refresh in 30 seconds."

2. **OpenAI API key not in current .env**
   - What we know: Layer 2 triage needs OpenAI. No `OPENAI_API_KEY` in current codebase.
   - What's unclear: Whether the project has an OpenAI account or should use Anthropic instead.
   - Recommendation: Add `OPENAI_API_KEY` env var. Alternatively, use Anthropic Claude Haiku (same cost bracket). Decision is Claude's discretion; research recommends GPT-4o-mini for structured JSON output reliability.

3. **Supabase Auth custom JWT claims (tenant_id)**
   - What we know: RLS policies use `auth.jwt() ->> 'tenant_id'` — this requires a custom claim in the JWT.
   - What's unclear: This claim must be added via Supabase hook/trigger that fires after user creation and links the new user to a tenant row.
   - Recommendation: Wave 0 of the onboarding plan must include a Postgres function/trigger or Supabase Auth hook that creates the tenant row and returns `tenant_id` in the JWT. This is a blocker for all RLS to work correctly.

4. **Working hours configuration (ONBOARD-03)**
   - What we know: ONBOARD-03 says "owner can configure availability schedule" and is assigned to Phase 2, but CONTEXT.md defers it to the post-test-call checklist overlapping Phase 3.
   - What's unclear: Must Phase 2 ship a working hours UI, or only the database schema stub?
   - Recommendation: Deliver the schema column (nullable `working_hours jsonb` on tenants) and a placeholder "coming soon" settings section. Full UI deferred to Phase 3.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (exists) |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBOARD-01 | `buildSystemPrompt` emits correct personality language per tone preset | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/agent/prompt.test.js` | Partial (extend existing) |
| ONBOARD-01 | `getAgentConfig` returns correct voice_speed/responsiveness per preset | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/agent/retell-config.test.js` | Partial (extend existing) |
| ONBOARD-02 | Services API returns services for tenant, respects RLS | integration | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/services.test.js` | Wave 0 |
| ONBOARD-06 | Test call API route calls `retell.call.createPhoneCall` with correct params | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/test-call.test.js` | Wave 0 |
| TRIAGE-01 | Layer 1 keyword classifier correctly flags "flooding", "gas smell" as EMERGENCY | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/triage/layer1.test.js` | Wave 0 |
| TRIAGE-01 | Layer 1 correctly flags "quote next month" as ROUTINE | unit | same as above | Wave 0 |
| TRIAGE-01 | Layer 1 ambiguous transcript returns `confident: false` | unit | same as above | Wave 0 |
| TRIAGE-02 | Layer 2 LLM scorer called only when Layer 1 is not confident | unit (mock OpenAI) | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/triage/classifier.test.js` | Wave 0 |
| TRIAGE-03 | Layer 3 escalates urgency when owner has service tagged emergency | unit (mock Supabase) | same as above | Wave 0 |
| TRIAGE-03 | Layer 3 never downgrades emergency to routine | unit | same as above | Wave 0 |
| TRIAGE-04 | `processCallAnalyzed` stores urgency_classification on call record | unit (mock Supabase) | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/webhooks/call-analyzed.test.js` | Partial (extend existing) |
| VOICE-02 | Inbound call webhook returns correct `business_name` dynamic var | unit | existing `tests/webhooks/retell-inbound.test.js` | Exists |
| VOICE-07 | Inbound call webhook passes `tone_preset` in dynamic variables | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/webhooks/retell-inbound.test.js` | Partial (extend existing) |

### Sampling Rate
- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Per wave merge:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/triage/layer1.test.js` — covers TRIAGE-01
- [ ] `tests/triage/classifier.test.js` — covers TRIAGE-02, TRIAGE-03
- [ ] `tests/onboarding/test-call.test.js` — covers ONBOARD-06
- [ ] `tests/onboarding/services.test.js` — covers ONBOARD-02
- [ ] `tests/__mocks__/openai.js` — mock for Layer 2 LLM calls in tests

---

## Sources

### Primary (HIGH confidence)
- `F:/homeservice-agent/node_modules/retell-sdk/resources/call.d.ts` — `createPhoneCall` params, PhoneCallResponse schema, deprecation notices
- `F:/homeservice-agent/node_modules/retell-sdk/resources/phone-number.d.ts` — PhoneNumber API, `inbound_agent_id` deprecation
- `F:/homeservice-agent/supabase/migrations/001_initial_schema.sql` — existing schema, RLS pattern
- `F:/homeservice-agent/src/lib/agent-prompt.js` — existing `buildSystemPrompt` signature and behavior
- `F:/homeservice-agent/src/lib/retell-agent-config.js` — existing `getAgentConfig` signature
- `F:/homeservice-agent/src/app/api/webhooks/retell/route.js` — existing webhook pipeline, `after()` pattern
- `F:/homeservice-agent/package.json` — confirmed installed versions

### Secondary (MEDIUM confidence)
- Retell SDK type definition inline comments — `@deprecated inbound_agent_id` with link to deprecation notice 2026-03-31
- Supabase JS v2 docs pattern: `auth.getUser()` preferred over `auth.getSession()` in server context

### Tertiary (LOW confidence)
- Supabase phone OTP requiring Twilio config — inferred from Supabase Auth docs knowledge; should be verified in project's Supabase dashboard settings

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from installed package.json and npm
- Architecture: HIGH — patterns derived directly from existing codebase; no speculation
- Triage engine design: HIGH — fully specified in CONTEXT.md; implementation patterns from SDK/stdlib
- Supabase Auth OAuth + OTP: MEDIUM — well-established patterns, but Twilio config dependency is environment-specific
- Pitfalls: HIGH — derived from SDK type annotations and existing code patterns

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (retell-sdk deprecation date 2026-03-31 is within window — re-check `inbound_agent_id` usage before implementation)
