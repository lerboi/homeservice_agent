# Phase 2: Onboarding and Triage - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Owner can configure their business (name, greeting tone, services, hours, escalation rules) and the three-layer triage engine correctly classifies calls as emergency, routine, or high-ticket based on owner-defined rules. The onboarding flow gets the owner to hear their AI answer a test call within 5 minutes of starting.

</domain>

<decisions>
## Implementation Decisions

### 5-Minute Activation Gate (The "2-Minute Sprint")
- Onboarding stripped to bare essentials — 3 steps before the AI goes live:
  - **Step 1:** Business name + tone preset (Professional / Friendly / Local Expert)
  - **Step 2:** Pick a trade template (Plumber, HVAC, Electrician, General Handyman), get a starter service list with smart defaults pre-tagged (e.g., "Gas Leak" = Emergency). Owner can add/remove/rename up to 3 high-ticket services
  - **Step 3:** Verify owner's mobile number (SMS code) AND assign/display the Retell AI phone number — both in one step
- Immediately after Step 3, dashboard shows: "Call your new AI assistant now at [Number] to test it."
- Test call available two ways: "Test your AI" button (triggers Retell outbound call to owner's phone) AND owner can dial the Retell number directly
- Full configuration unlocked ONLY after the owner completes a test call — progressive disclosure, not upfront overload

### Post-Test-Call Experience
- Guided checklist unlocks after test call: add more services, set working hours, configure escalation rules, etc.
- Completion percentage / gamified progression — "optimization tasks" not "setup hurdles"
- All settings remain editable anytime from the dashboard

### Onboarding Wizard Flow
- Multi-step pages with progress bar (Step 1 of 3), forward/back navigation
- Authentication: Google OAuth as primary ("Sign in with Google"), email/password as fallback — Supabase Auth
- Trade templates for 4 core trades: Plumber, HVAC, Electrician, General Handyman
- Templates provide starter service list + smart defaults (urgency tags pre-applied)
- Owner can customize template: add/remove/rename services during onboarding sprint

### AI Persona / Tone Presets
- 3 tone presets: Professional, Friendly, Local Expert
- Each preset changes BOTH the system prompt personality AND Retell voice parameters (speed, responsiveness)
  - Professional: measured pace, formal language
  - Friendly: upbeat pace, casual warmth
  - Local Expert: relaxed pace, neighborhood-friendly tone
- No audio preview during onboarding — owner hears it on the test call, can change anytime from settings
- No free-text greeting scripts in v1 — presets only, keeps it simple

### Service List & Triage Rules
- **During sprint (onboarding):** Smart defaults from trade template. System pre-tags services with Emergency/Routine/High-Ticket based on template. Owner doesn't manually tag during sprint.
- **In dashboard (post-test-call):** Tag-per-service view. Simple table of all services with a dropdown (Emergency / Routine / High-Ticket) next to each row. Owner changes a tag and hits Save — no rule builder, no if/then logic.
- Trade templates ship for: Plumber, HVAC, Electrician, General Handyman (4 templates day one)

### Three-Layer Triage Engine
- **Architecture:** Sequential pipeline with highest-severity-wins override
  - Layer 1 (Keywords/regex): Runs first. If confident match (e.g., "flooding", "gas smell"), classifies immediately — skip Layer 2
  - Layer 2 (LLM urgency): Runs on ambiguous cases. Uses temporal cues ("happening right now" vs "next month") and caller stress indicators
  - Layer 3 (Owner rules): Always applies as final override. Owner's service-to-urgency tag mapping
  - **Override rule:** If ANY layer flags emergency, the call is emergency regardless of other layers
- **Output:** Each call gets an urgency classification (Emergency / Routine / High-Ticket) stored on the lead/call record

### Triage-Aware AI Behavior
- AI adjusts tone and pace based on triage result during the call:
  - Emergency: faster, more direct ("I understand this is urgent, let me get someone to you right away")
  - Routine: relaxed info gathering
- Priority escalation for emergencies: trigger a priority notification to owner even before Phase 4 notification system is built (lightweight mechanism — webhook/log/simple SMS via Supabase edge function)
- Triage label + urgency score visible on call/lead record (for Phase 4 dashboard)

### Claude's Discretion
- Keyword/regex list design for Layer 1 (what terms map to what urgency)
- LLM prompt design for Layer 2 urgency scoring
- Exact trade template contents (specific services per trade, default tags)
- Database schema additions for services, triage rules, escalation config
- Retell voice parameter values per tone preset
- SMS verification implementation details
- Priority escalation mechanism for emergencies (lightweight, pre-Phase-4)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core value prop, triage intelligence description (three-layer system), constraints
- `.planning/REQUIREMENTS.md` — ONBOARD-01 through ONBOARD-06, TRIAGE-01 through TRIAGE-05, VOICE-02, VOICE-07
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 test scenarios)

### Prior phase context
- `.planning/phases/01-voice-infrastructure/01-CONTEXT.md` — Tech stack decisions (Next.js/JS, Supabase, Vercel), language support scope, default call behavior, recording handling

### Database schema
- `supabase/migrations/001_initial_schema.sql` — Current tenants and calls tables (need extension for services, triage rules)

### Existing code
- `src/lib/agent-prompt.js` — Current system prompt builder (needs extension for tone presets and triage-aware behavior)
- `src/lib/retell-agent-config.js` — Retell agent config (needs tone preset voice parameters)
- `src/app/api/webhooks/retell/route.js` — Webhook handler (reads tenant config on inbound call)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildSystemPrompt(locale, { business_name, onboarding_complete })` — Already branches on onboarding status; needs extension for tone presets and triage-aware responses
- `getAgentConfig()` — Already configures voice_speed, responsiveness; needs tone preset variants
- Supabase client (`src/lib/supabase.js`) — Server-side client with service role key, ready for new table operations
- Supabase browser client (`src/lib/supabase-browser.js`) — For dashboard/wizard frontend
- next-intl i18n layer (`src/i18n/`) — Translation infrastructure for wizard UI strings

### Established Patterns
- Multi-tenant via `tenant_id` column + RLS policies on every table
- Webhook handler uses `after()` for deferred heavy processing (pattern for triage processing)
- `tenants` table already has `onboarding_complete` boolean — webhook handler reads it on every inbound call
- Service role bypass policies already exist for server-side operations

### Integration Points
- `handleInbound()` in webhook route reads tenant config and passes to Retell as `dynamic_variables` — this is where tone preset and triage config feed into the AI
- `tenants` table needs new columns/related tables for: services, tone_preset, trade_type, escalation config
- Supabase Auth already in stack — needs Google OAuth provider configuration
- Retell API for outbound test call trigger and phone number management

</code_context>

<specifics>
## Specific Ideas

- "If we ask for 20 service types and a custom persona script upfront, the owner will drop off before the AI ever says Hello" — the entire onboarding philosophy is speed-to-aha-moment
- Progressive disclosure: full config is "optimization tasks" unlocked post-test-call, not "setup hurdles" blocking activation
- Smart defaults from templates mean the AI is useful immediately — owner only customizes if they want to
- Tag-per-service with simple dropdown for urgency classification — "If I want all Water Heater calls to be High-Ticket for a summer promotion, I just change the tag and hit Save"
- No rule builders, no if/then logic — simplicity over power for SME owners

</specifics>

<deferred>
## Deferred Ideas

- Cal.com integration for calendar sync — mentioned during discussion, belongs in Phase 3 (SCHED-02/03)
- Audio preview clips for tone presets — skip for v1, owner hears it on test call
- Free-text custom greeting scripts — presets only for v1, could add in future
- Additional trade templates beyond core 4 — can expand based on demand
- Working hours configuration — part of post-test-call guided checklist, may overlap with Phase 3 scheduling

</deferred>

---

*Phase: 02-onboarding-and-triage*
*Context gathered: 2026-03-19*
