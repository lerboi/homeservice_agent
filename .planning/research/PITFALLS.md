# Pitfalls Research

**Domain:** AI voice receptionist + home service booking platform (SaaS)
**Researched:** 2026-03-18
**Confidence:** MEDIUM (web search unavailable; based on training knowledge through Aug 2025 covering Vapi/Retell production usage, telephony systems, calendar API behavior, and home service SaaS patterns)

---

## Critical Pitfalls

### Pitfall 1: Treating Latency as a Voice Quality Problem, Not a System Architecture Problem

**What goes wrong:**
Teams focus on picking the best TTS voice and lowest-latency STT model, but the real latency killer is the round-trip time of function calls (tool calls) during the conversation. When the AI needs to check calendar availability or look up a time slot mid-conversation, the user experiences a 2-4 second silence — which feels like the call dropped. Callers hang up or assume the system is broken.

**Why it happens:**
Vapi and Retell both use function/tool calls to invoke external APIs during conversations. Developers build these as synchronous blocking calls to their own backend, which then calls Google Calendar or a database. Each hop adds latency: voice platform → your server → calendar API → your server → voice platform → TTS render. Even at 300ms per hop, four hops = 1.2 seconds of dead air. If calendar API is slow (Google Calendar can spike to 1-2s under load), total dead air hits 3-4 seconds.

**How to avoid:**
- Pre-load availability windows into a fast in-memory cache (Redis) at the start of each call
- Use a slot reservation table in your own database — never query Google Calendar live during a call
- Calendar sync runs async on a background job (poll every 60-120 seconds, or via webhook push)
- Keep all function call responses under 800ms by measuring p95 latency in staging with realistic data
- Use Vapi's `background_denoising` and filler audio (brief "let me check that for you") to mask unavoidable pauses

**Warning signs:**
- Function call round-trip exceeds 800ms in load testing
- Average call duration is short (callers hanging up mid-booking flow)
- "Silence felt weird" feedback in early user tests
- Calendar availability queries hitting Google Calendar API directly from the function call handler

**Phase to address:** Voice Infrastructure phase (earliest possible — establishes the async availability pattern before any booking logic is built on top of it)

---

### Pitfall 2: Non-Atomic Slot Locking Creates Double-Bookings

**What goes wrong:**
Two calls arrive within seconds of each other. Both query available slots, both see 2pm Tuesday as open, both proceed to book it. The owner gets two jobs at the same time, one customer gets a no-show, and trust in the platform collapses. For home service owners, a double-booking isn't just an inconvenience — it's a broken promise to a customer who may have taken time off work to be home.

**Why it happens:**
The naive implementation reads available slots, picks the best one, then writes the booking as two separate operations. Between read and write, another concurrent booking can sneak in. This is a classic TOCTOU (time-of-check to time-of-use) race condition. It's especially likely at peak times (morning rush, after a weather event when emergency calls spike).

**How to avoid:**
- Implement optimistic locking with a slot reservation table: `SELECT ... FOR UPDATE` or equivalent atomic compare-and-swap
- Use a two-phase commit pattern: (1) soft-reserve the slot with a short TTL (e.g., 90 seconds) at the start of the booking conversation, (2) hard-confirm on booking completion, (3) release reservation if call ends without confirmation
- Never use application-level "check then write" — the lock must be at the database layer
- For PostgreSQL: use `SELECT ... FOR UPDATE SKIP LOCKED` to safely claim a slot in a concurrent environment
- Write an explicit concurrency test that fires 10 simultaneous booking attempts at a single slot and asserts exactly 1 succeeds

**Warning signs:**
- No concurrency tests in the booking flow
- Slot availability check and booking write are separate database calls with no transaction
- Calendar sync reads and booking writes share the same lock scope (or no lock scope at all)
- "Available slots" are computed in application code from raw calendar data rather than a dedicated reservation table

**Phase to address:** Scheduling & Booking phase (must be designed atomically from day one — retrofitting locking logic into an existing booking flow is high risk)

---

### Pitfall 3: Triage Logic That Works in Testing, Fails on Real Callers

**What goes wrong:**
The keyword-based emergency detection works perfectly in scripted tests ("I have a gas leak") but misclassifies real callers who speak indirectly, use regional language, or describe symptoms without naming the emergency. A caller who says "my basement is completely underwater and I don't know what to do" doesn't say "flooding" — but it's an emergency. Conversely, a caller saying "I need this fixed urgently" for a non-urgent job gets over-triaged into an emergency slot, wasting the owner's premium availability.

**Why it happens:**
Developers build against idealized test inputs. Real callers are stressed, speak in fragments, use non-standard vocabulary, describe context rather than label the problem, and mix urgency signals with routine requests. Keyword lists are brittle — they match what the developer imagined callers would say, not what callers actually say.

**How to avoid:**
- Use LLM-based intent classification for triage, not keyword matching alone — keywords can be a fast pre-filter but LLM should make the final call
- Include a confidence threshold: below threshold, default to a clarifying question ("Is this something that needs immediate attention today, or can we schedule for later this week?")
- Seed the triage prompt with real-world examples gathered from home service industry call recordings or operator feedback
- Build an override path: callers can always say "this is an emergency" and override the classification
- Log every triage decision with the reasoning so misclassifications can be reviewed and corrected
- Run the triage prompt against a test set of 50+ realistic caller scenarios before shipping

**Warning signs:**
- Triage test cases are all clean, unambiguous sentences
- No fallback question when confidence is low
- Owner reports receiving wrong-urgency notifications in first week
- No mechanism to review or correct past triage decisions

**Phase to address:** AI Intelligence / Triage phase — triage logic must be tested against realistic messy inputs, not idealized ones, before it's connected to real calendar slots

---

### Pitfall 4: Google Calendar Sync as the Source of Truth

**What goes wrong:**
The system treats Google Calendar as the authoritative availability database. When Google Calendar has a brief outage, rate-limits the API, revokes an OAuth token, or a calendar event is deleted outside the system, the booking platform either crashes, shows phantom availability, or silently stops syncing. Owners don't notice until they've received double-bookings or callers are told no slots are available during what should be open time.

**Why it happens:**
Google Calendar feels like the natural source of truth because the owner already lives in it. Teams build a direct-read architecture where every availability check queries the Calendar API, then discover that Calendar APIs have rate limits (10,000 requests/day on free tier, but still limited), OAuth tokens expire, and the API is not designed for sub-second booking confirmation queries.

**How to avoid:**
- The platform's own database is the source of truth for availability, not Google Calendar
- Google Calendar sync is a bidirectional background sync: your DB is authoritative, Calendar reflects it
- Implement OAuth token refresh proactively with health monitoring — alert the owner if calendar sync breaks
- Build a "sync health" indicator in the dashboard so owners can see if calendar is connected
- Store the last sync timestamp; if stale by more than 5 minutes, surface a warning
- Handle calendar API errors gracefully: fall back to last-known availability rather than crashing

**Warning signs:**
- Availability query logic reads directly from Google Calendar API
- No sync health monitoring or alerting
- OAuth token expiry causes silent sync failure
- No retry/backoff logic on calendar API calls

**Phase to address:** Scheduling & Booking phase (architecture decision must be made before any calendar integration code is written)

---

### Pitfall 5: Voice AI Hallucinating Business Information

**What goes wrong:**
The AI confidently tells callers incorrect information — wrong business hours, a service the business doesn't offer, a price range it invented, an address that's slightly wrong. The caller shows up at the wrong time, expects a service that isn't available, or loses trust. Worse, in regulated trades (gas fitting, electrical), an AI casually offering safety assessments or quoting compliance-related work can create liability.

**Why it happens:**
LLMs have a strong tendency to fill knowledge gaps with plausible-sounding completions. If the system prompt doesn't explicitly constrain the AI to only speak from configured business data, the LLM will improvise when asked questions outside its configured scope. This is especially dangerous for specifics (prices, addresses, certifications, availability of specific technicians).

**How to avoid:**
- System prompt must explicitly instruct: "If you don't know, say 'I'll have [owner name] call you back with that information' — never guess"
- All business-specific facts (services, hours, service area, pricing ranges) must be injected as structured data into the prompt at call start — never rely on the LLM's training knowledge
- Implement a "knowledge boundary" test: call the agent and ask 10 questions it shouldn't know — verify it defers rather than invents
- For regulated trades: add explicit guardrails against providing safety diagnoses, compliance assessments, or permit advice
- Review call transcripts in the first week specifically hunting for hallucinated facts

**Warning signs:**
- System prompt allows open-ended responses without a fallback instruction
- Business information isn't injected dynamically at call start
- No transcript review process in early operation
- Caller asks about pricing and AI quotes a specific number that doesn't come from configuration

**Phase to address:** Voice Intelligence / Prompt Engineering phase — hallucination guardrails must be in the initial system prompt design, not added after complaints

---

### Pitfall 6: Multi-Language Support as an Afterthought

**What goes wrong:**
The system is built English-first with language support "to be added later." When multi-language is added, it requires restructuring the prompt system, the triage keyword lists (which are English-specific), the notification templates, the onboarding flow, and the voice model selection logic. The retrofit costs 3x more than building it in from the start, and the result is an inconsistent experience (English UI, Spanish voice, English SMS notifications).

**Why it happens:**
"We'll add Spanish later" is a common deferral that underestimates how deeply language assumptions are woven into every layer — not just the voice, but all text content, date/time formatting, address formats, and even the triage logic (emergency keywords vary by language).

**How to avoid:**
- Design the language selection mechanism from day one: detect caller language in first 2-3 turns, or allow the owner to configure a default language
- All user-facing text (prompts, notifications, UI labels) must be stored in translatable strings from the start — no hardcoded English strings
- Triage keyword lists and urgency patterns must be language-aware
- SMS/email notification templates must support multiple languages
- Vapi/Retell voice model selection must be parameterized by language, not hardcoded to an English model

**Warning signs:**
- All system prompts written as literal English strings in code
- Notification templates with hardcoded English text
- Triage keyword lists with no language parameter
- "Language support" is listed as a later phase with no architecture placeholder

**Phase to address:** Voice Infrastructure phase — language abstraction layer must be in place before any language-specific content is written

---

### Pitfall 7: Onboarding Complexity That Prevents Owner Activation

**What goes wrong:**
The platform requires owners to configure 15+ fields before making their first call — services list, tiers, availability windows, greeting script, emergency keywords, notification preferences, calendar connection. Most SME owners are non-technical, pressed for time, and will abandon a multi-step setup without getting value first. The product dies in the onboarding funnel before anyone hears the AI's voice.

**Why it happens:**
Developers build onboarding to match the system's internal data model rather than the owner's mental model. Every feature requires configuration, so developers expose every configuration field. The result is an enterprise-grade setup flow for a business owner who just wants calls answered.

**How to avoid:**
- Design a "30-second onboarding" path: business name, phone number, business type (plumber/HVAC/electrician), and done — AI uses sensible defaults for everything else
- Use business type to auto-populate a starter configuration (services list, emergency keywords, default availability template)
- Defer all advanced configuration to a "settings" section — make it optional, not required
- Show live demo capability immediately after minimal setup (call your number now, hear the AI answer)
- Progressive disclosure: surface advanced settings only after the owner has completed their first call

**Warning signs:**
- Onboarding flow requires calendar connection before first call can be made
- No default/starter configurations by trade type
- Setup has more than 5 required fields before a test call can be made
- No guided tour or contextual help for non-technical owners

**Phase to address:** Onboarding & Dashboard phase — validate with real SME users that setup to first call takes under 5 minutes

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Query Google Calendar directly per function call | No cache to maintain | Latency spikes, rate limits, silent failures | Never — build the async cache layer from the start |
| Store triage rules as hardcoded keyword arrays | Fast to implement | Language brittle, hard to update per-owner, missed classifications | Only in a throwaway prototype, never in production |
| English-only prompts and templates | Faster first version | Massive retrofit cost when multi-language needed; inconsistent UX | Never — use translatable strings from day one |
| No soft-reservation TTL (book immediately) | Simpler flow | Race conditions under concurrent load | Never for a booking system |
| Single-environment Vapi/Retell config | One less thing to manage | Can't test without hitting production webhook/phone number | Only in solo developer with no users; add staging before first external tester |
| Store call recordings only in Vapi/Retell platform | No storage cost | Recordings lost if you switch platforms or account is suspended | Only in early dev; migrate to own storage before first real customer |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vapi/Retell webhook | Not validating webhook signatures — anyone can POST fake call events | Always verify HMAC signature on every inbound webhook before processing |
| Google Calendar OAuth | Using a single OAuth token for all customer calendars in dev, not per-customer tokens in production | Each owner authorizes their own Google account; store per-owner refresh tokens encrypted |
| Google Calendar API | Not handling `410 Gone` (deleted event) responses — causes phantom availability | Treat 410 as a sync signal: delete the local event record and re-sync |
| Twilio/phone number provisioning | Buying a phone number but not configuring the webhook URL before first test | Configure webhook at number-purchase time; test with a call immediately after provisioning |
| Vapi function calls | Returning errors as HTTP 500 — Vapi retries aggressively, causing duplicate bookings | Return HTTP 200 with an error payload; let the AI handle the error gracefully in the conversation |
| Retell custom LLM endpoint | Using streaming responses without handling partial JSON — causes silent parse failures | Test streaming endpoint with a mock that sends partial chunks; verify assembly logic |
| Google Calendar events | Creating events without a timezone — Calendar assumes UTC, owner sees wrong times | Always specify `timeZone` in every event create/update call, derived from owner's configured timezone |
| SMS notifications (Twilio/etc.) | Not handling delivery failures — owner never knows a notification was lost | Implement delivery status webhooks; surface failed notifications in the dashboard |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous calendar availability check during voice function call | 2-4s dead air during booking conversation | Async cache with pre-loaded availability windows | At 1 concurrent call — it's always slow |
| Loading all leads into dashboard with no pagination | Dashboard hangs for owners with 6+ months of history | Cursor-based pagination from day one | ~500 leads (common after 3 months for active business) |
| Storing call transcripts as full text in the main CRM table | Full-text search and list queries slow | Store transcripts in separate object/blob storage; reference by ID in CRM | ~200 calls (transcripts are large) |
| No database indexes on lead status + created_at | Lead pipeline queries slow | Add composite index (status, created_at, business_id) at migration time | ~1,000 leads |
| Polling calendar sync every 5 seconds per connected business | DB and Calendar API hammering | Exponential backoff sync; use webhook push where available (Google Calendar push notifications) | ~20 connected businesses |
| Logging every STT word event to the database | Write amplification, DB bloat | Buffer in memory, write completed transcripts only | ~50 concurrent calls |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing caller phone numbers in client-side API responses without auth | PII leak; caller data harvested by competitors | All caller PII behind authenticated API; no PII in public endpoints or logs |
| Storing call recordings as publicly accessible URLs | Any person with the URL can listen to a private call | Store recordings in private object storage with signed/expiring URLs |
| Not encrypting Google OAuth refresh tokens at rest | Compromised DB = attacker can access every connected owner's Google Calendar | Encrypt refresh tokens with app-level key (AES-256); never store plaintext |
| Allowing Vapi/Retell webhooks without signature validation | Attacker can POST fake "call completed" events, inject fake bookings | Validate HMAC signatures on every webhook; reject unsigned requests |
| Multi-tenant data leakage (missing business_id filter) | Owner A sees Owner B's leads | Every DB query must include business_id scoping; integration test for cross-tenant access |
| Logging full call transcripts to application logs | Transcripts contain PII (caller name, address, phone) that appears in log aggregators | Never log transcript content; log metadata only (call ID, duration, outcome) |
| Weak Vapi/Retell API key rotation policy | Leaked key = attacker can make calls billed to your account | Rotate API keys on any suspected exposure; store in secrets manager, not .env files in repo |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AI says "I'll book you for [time]" before slot is actually confirmed | Caller told a time that later fails to book; creates broken promises | Only confirm a time slot after the database reservation is committed; say "checking availability" while doing so |
| Greeting too long ("Hello, thank you for calling ABC Plumbing, your trusted local plumber since 1987, how can I help?") | Callers hang up in first 5 seconds; "just answer the call" frustration | Greeting under 5 words plus pause: "ABC Plumbing, go ahead." Callers speak immediately |
| No way for caller to reach a human | Callers who want a real person feel trapped; creates distrust in AI | Always offer "press 0 or say 'operator' to leave a voicemail for [owner name]" as an escape hatch |
| Dashboard notifications without context | Owner sees "New lead" with no job type, no address, no urgency — wastes time clicking in | Every notification includes: caller name, job type, urgency level, address, and a one-tap "call back" link |
| No confirmation to the caller after booking | Caller hangs up uncertain — "did I actually get booked?" | End every booking with a verbal confirmation summary AND an SMS confirmation to the caller |
| Owner can't listen to calls from the dashboard | Owner can't verify what was promised or coach on misclassifications | Call recordings accessible (1-click play) directly from the lead detail view |
| Showing raw AI transcript without structure | Hard to scan; owner can't find the key info quickly | Lead detail shows extracted fields (job type, urgency, address, time slot) prominently; transcript is secondary/expandable |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Voice agent answers calls:** Verify it handles mid-sentence interruptions (barge-in) without losing context — most demos show clean turn-by-turn only
- [ ] **Calendar booking works:** Verify two simultaneous booking attempts for the same slot result in exactly one confirmation and one "next available" offer — concurrency test must exist
- [ ] **Triage classifies emergencies:** Verify it correctly handles indirect emergency descriptions ("water everywhere in my garage" not "flooding") — test with 20+ realistic non-idealized phrases
- [ ] **Google Calendar syncs:** Verify behavior when owner deletes an event in Google Calendar directly — does the slot re-open? Does a booking get orphaned?
- [ ] **Multi-language works:** Verify that a Spanish-speaking caller gets Spanish SMS notifications and Spanish voice responses end-to-end, not just a Spanish voice with English notifications
- [ ] **Owner notifications fire:** Verify SMS and email notifications work when the SMS provider has a temporary failure — do they retry? Does the owner get told?
- [ ] **Call recordings are stored:** Verify recordings survive a Vapi/Retell account token rotation — are they in your storage or only in their platform?
- [ ] **Onboarding is complete:** Verify a non-technical user (not a developer) can complete setup in under 5 minutes — test with an actual SME, not a teammate

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Double-booking discovered | HIGH | (1) Contact both customers immediately, (2) manually re-slot one, (3) audit the slot locking code for the race condition, (4) replay recent bookings to check for other doubles, (5) write regression test |
| Voice AI hallucinated business info to caller | MEDIUM | (1) Review transcript, (2) correct the system prompt with explicit constraints, (3) if caller was given wrong commitment, owner calls back to correct, (4) audit other calls for same pattern |
| Google Calendar OAuth token expired silently | LOW-MEDIUM | (1) Alert owner to re-authorize, (2) replay missed sync window by pulling calendar events for last 24h, (3) check for bookings made in the gap against calendar events |
| Triage misclassified emergency as routine | HIGH | (1) Owner calls back immediately, (2) review and update triage prompt, (3) add the misclassified phrase as a labeled example in the test set, (4) re-run full triage test suite |
| Call recording lost (platform-only storage) | HIGH | (1) Contact Vapi/Retell support for recovery, (2) accept data loss for past calls, (3) immediately implement recording export to own storage, (4) communicate transparently to affected owners |
| Multi-tenant data leak (owner sees wrong leads) | CRITICAL | (1) Immediately audit all API endpoints for missing business_id scoping, (2) notify affected owners, (3) rotate all API keys, (4) engage security review before reopening access |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Voice latency (function call dead air) | Voice Infrastructure (Phase 1) | Function call p95 latency < 800ms in load test before connecting to booking |
| Non-atomic slot locking | Scheduling & Booking (Phase 2) | Concurrency test: 10 simultaneous attempts on one slot → exactly 1 succeeds |
| Triage misclassification | AI Intelligence / Triage (Phase 2-3) | Triage accuracy test set: 50+ realistic caller phrases, >90% correct classification |
| Google Calendar as source of truth | Scheduling & Booking (Phase 2) | Architecture review: calendar sync is async background job; availability reads from own DB |
| AI hallucinating business info | Voice Intelligence / Prompts (Phase 1-2) | Knowledge boundary test: 10 out-of-scope questions all result in "I'll have [owner] call you" |
| Multi-language as afterthought | Voice Infrastructure (Phase 1) | All text content uses translatable string keys; switching language mid-config works end-to-end |
| Onboarding complexity | Onboarding & Dashboard (Phase 3-4) | Non-technical user (not developer) completes setup to first test call in < 5 minutes |
| Webhook signature not validated | Voice Infrastructure (Phase 1) | Unsigned webhook POST returns 401; duplicate event POST is idempotent |
| Call recordings in platform-only storage | Voice Infrastructure (Phase 1) | Recordings stored in own object storage within 24h of call completion |
| Multi-tenant data leakage | Any DB/API phase | Automated cross-tenant access test: Owner A's token cannot retrieve Owner B's leads |

---

## Sources

- Vapi documentation and community (training knowledge through Aug 2025) — MEDIUM confidence
- Retell AI documentation and developer community (training knowledge through Aug 2025) — MEDIUM confidence
- Google Calendar API documentation — behavior of rate limits, push notifications, OAuth — HIGH confidence (stable API)
- General patterns: voice AI latency constraints, TOCTOU race conditions in booking systems, LLM hallucination mitigation — HIGH confidence (well-established)
- Home service SME onboarding behavior, caller psychology — MEDIUM confidence (pattern from comparable SaaS domains)
- Note: Web search and WebFetch were unavailable during this research session. Claims marked MEDIUM or LOW should be validated against current Vapi/Retell changelogs and community discussions before committing to architecture decisions.

---
*Pitfalls research for: AI voice receptionist + home service booking platform*
*Researched: 2026-03-18*
