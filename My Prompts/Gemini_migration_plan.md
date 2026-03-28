# Voco Voice System Migration Plan

## Retell + Groq → Twilio + LiveKit + Gemini Live

**Created**: 2026-03-28
**Status**: Planning
**Estimated Phases**: 8

---

## Table of Contents

1. [Architecture Overview](#phase-0--architecture-overview)
2. [Phase 1: LiveKit Cloud + Twilio SIP Setup](#phase-1-livekit-cloud--twilio-sip-setup)
3. [Phase 2: LiveKit Agent Scaffold + Gemini Live Session](#phase-2-livekit-agent-scaffold--gemini-live-session)
4. [Phase 3: System Prompt Port + Voice Configuration](#phase-3-system-prompt-port--voice-configuration)
5. [Phase 4: Tool Implementation (In-Process)](#phase-4-tool-implementation-in-process)
6. [Phase 5: Post-Call Pipeline + Recording + Transcripts](#phase-5-post-call-pipeline--recording--transcripts)
7. [Phase 6: Database Migration + Dashboard Updates](#phase-6-database-migration--dashboard-updates)
8. [Phase 7: Onboarding Flow + Phone Provisioning Changes](#phase-7-onboarding-flow--phone-provisioning-changes)
9. [Phase 8: Cleanup + Cutover + Testing](#phase-8-cleanup--cutover--testing)
10. [Environment Variables](#environment-variables)
11. [Rollout Strategy](#rollout-strategy)
12. [Cost Analysis](#cost-analysis)
13. [Risk Register](#risk-register)

---

## Phase 0 — Architecture Overview

### Current Architecture (Retell + Groq)

```
Caller dials Retell-managed number
  → Retell sends call_inbound webhook → Next.js (Vercel)
      (tenant lookup, slot calc, returns dynamic_variables)
  → Retell opens WebSocket → Railway server (server.js)
      (streams transcript to Groq Llama 4 Scout, streams tokens back)
  → Tool calls: Groq → server.js → Retell → webhook → Next.js → Supabase → response back
  → Call ends → call_ended webhook → processCallEnded()
  → Minutes later → call_analyzed webhook → processCallAnalyzed()
      (recording download from Retell CDN, triage, lead creation, notifications)
```

**Problems**: Tool calls require 4 network hops (Groq → server.js → Retell → webhook → Supabase → back). Recording/transcript arrive minutes after call. Retell vendor lock-in.

### New Architecture (Twilio + LiveKit + Gemini Live)

```
Caller dials Twilio number
  → Twilio SIP trunk → LiveKit SIP service
  → LiveKit creates room + dispatches agent worker
  → Agent worker (Node.js, LiveKit Cloud or Railway):
      1. Looks up tenant by dialed number (direct Supabase query)
      2. Calculates available slots
      3. Opens Gemini Live session with system prompt + tools
      4. Gemini processes audio natively (no STT/TTS pipeline)
      5. Tool calls execute IN-PROCESS (direct Supabase, zero network hops)
      6. LiveKit Egress records audio → uploads to Supabase Storage
      7. Gemini provides real-time transcription (input + output)
  → Call ends → agent runs post-call pipeline in-process:
      triage, lead creation, notifications, calendar sync, usage tracking
```

**Improvements**:
- Tool call latency: ~500ms (4 hops) → ~50ms (in-process)
- Voice quality: STT→LLM→TTS pipeline → native audio-to-audio
- Recording: available immediately (Egress), not minutes later
- Transcript: real-time from Gemini, not post-call from Retell
- No Retell dependency

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Gemini model** | `gemini-3.1-flash-live-preview` | Lowest latency native audio model, thinking levels, best voice quality. All 6 tools are synchronous (AI waits for result before continuing), so sync-only function calling is not a limitation. |
| **LiveKit deployment** | LiveKit Cloud | Built-in SIP service, Egress, scaling, observability. Self-hosting requires managing SIP + Egress separately. |
| **Agent runtime** | LiveKit Cloud Agents (Node.js) | Same language as codebase. `lk agent create` handles deployment. Alternative: Railway with self-hosted worker. |
| **SIP trunk** | Twilio Elastic SIP Trunking | Already have Twilio account. Elastic trunking supports SIP REFER (needed for warm transfer), outbound calls (test calls), and is production-proven with LiveKit. |
| **Recording** | LiveKit Egress → Supabase Storage | Audio-only MP4, dual-channel (agent left, caller right). Upload to existing `call-recordings/` bucket in Supabase Storage. |
| **Transcript** | Gemini built-in transcription + AgentSession events | No separate STT needed. Gemini provides `inputTranscription` and `outputTranscription` alongside audio. |
| **Transfer** | LiveKit SIP REFER (cold transfer) | Simpler than warm transfer two-room pattern. Whisper message passed as SIP header or pre-transfer agent speech. Fallback: capture lead if transfer fails. |
| **Agent process location** | Standalone service (not inside Next.js) | Same as current Railway server — agent needs persistent WebSocket connections. Next.js on Vercel can't hold WebSockets. |

### Files Changed Summary

| Action | Files |
|--------|-------|
| **New (agent service)** | `livekit-agent/agent.ts`, `livekit-agent/tools.ts`, `livekit-agent/prompt.ts`, `livekit-agent/post-call.ts`, `livekit-agent/package.json`, `livekit-agent/tsconfig.json`, `livekit-agent/Dockerfile`, `livekit-agent/livekit.toml` |
| **New (Next.js)** | `src/app/api/livekit/webhook/route.js` (optional, for room events) |
| **Modified** | `src/app/api/onboarding/test-call/route.js`, `src/app/api/onboarding/provision-number/route.js`, `src/app/api/stripe/webhook/route.js`, `src/components/dashboard/AudioPlayer.jsx`, `src/app/dashboard/calls/page.js`, `src/components/dashboard/LeadFlyout.jsx` |
| **New migration** | `supabase/migrations/023_livekit_migration.sql` |
| **Removed** | `src/lib/retell.js`, `src/app/api/webhooks/retell/route.js`, retell-sdk from package.json |
| **Unchanged** | `src/lib/scheduling/*`, `src/lib/leads.js`, `src/lib/notifications.js`, `src/lib/triage/*`, `src/lib/whisper-message.js` |

---

## Phase 1: LiveKit Cloud + Twilio SIP Setup

**Goal**: Twilio phone numbers route calls into LiveKit rooms via SIP trunk.

### 1.1 LiveKit Cloud Project Setup

1. Create LiveKit Cloud account at cloud.livekit.io
2. Create a new project (e.g., `voco-production`)
3. Note down:
   - `LIVEKIT_URL` (e.g., `wss://voco-production.livekit.cloud`)
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
4. Install LiveKit CLI: `brew install livekit-cli` or `npm i -g @livekit/cli`
5. Authenticate: `lk cloud auth`

### 1.2 Twilio Elastic SIP Trunk Configuration

**Why Elastic SIP Trunking (not Programmable Voice TwiML)**: Elastic SIP Trunking supports SIP REFER (required for warm/cold transfer to owner), outbound calls (required for test calls), and is the recommended integration for LiveKit.

1. In Twilio Console → Elastic SIP Trunking → Create new trunk:
   - Name: `voco-livekit`
   - Under **Origination**:
     - Add Origination URI: `sip:<livekit-sip-endpoint>.sip.livekit.cloud;transport=tcp`
     - Priority: 10, Weight: 10
   - Under **Termination** (for outbound calls):
     - Set Termination SIP URI (e.g., `voco-livekit.pstn.twilio.com`)
     - Create credential list (username/password) for outbound auth
     - Enable PSTN Transfer (required for SIP REFER)
   - Under **Numbers**:
     - Associate existing Twilio phone numbers (US/CA numbers already purchased)
     - For SG numbers: these are already Twilio numbers in inventory, associate them too

2. Note: Numbers currently imported into Retell need to be unimported from Retell before they can be associated with the new SIP trunk. This happens during cutover (Phase 8).

### 1.3 LiveKit SIP Inbound Trunk

Create file `livekit-agent/sip-inbound-trunk.json`:
```json
{
  "trunk": {
    "name": "voco-twilio-inbound",
    "numbers": ["+1XXXXXXXXXX"],
    "krisp_enabled": true
  }
}
```

Deploy: `lk sip inbound create livekit-agent/sip-inbound-trunk.json`

**Note**: The `numbers` field will list all Twilio numbers. For multi-tenant routing, the agent determines the tenant by matching the dialed number (`to_number`) against `tenants.retell_phone_number` — same logic as the current `handleInbound` webhook.

### 1.4 LiveKit SIP Outbound Trunk (for test calls)

Create file `livekit-agent/sip-outbound-trunk.json`:
```json
{
  "trunk": {
    "name": "voco-twilio-outbound",
    "address": "voco-livekit.pstn.twilio.com",
    "numbers": ["+1XXXXXXXXXX"],
    "auth_username": "<termination_username>",
    "auth_password": "<termination_password>"
  }
}
```

Deploy: `lk sip outbound create livekit-agent/sip-outbound-trunk.json`

Save the returned trunk ID as `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` env var.

### 1.5 LiveKit SIP Dispatch Rule

Create file `livekit-agent/sip-dispatch-rule.json`:
```json
{
  "rule": {
    "dispatchRuleIndividual": {
      "roomPrefix": "call-"
    }
  },
  "name": "voco-inbound-dispatch",
  "attributes": {
    "sip.inbound": "true"
  }
}
```

Deploy: `lk sip dispatch create livekit-agent/sip-dispatch-rule.json`

This creates a new room for each inbound call with prefix `call-` (e.g., `call-abc123`). The room name serves as the call identifier (replaces `retell_call_id`).

### 1.6 Deliverables

- [ ] LiveKit Cloud project created with API credentials
- [ ] Twilio Elastic SIP trunk configured with origination → LiveKit
- [ ] Twilio termination configured for outbound calls
- [ ] LiveKit inbound trunk created
- [ ] LiveKit outbound trunk created
- [ ] LiveKit dispatch rule created
- [ ] Test: Twilio number rings → LiveKit room created (no agent yet, call drops after timeout)

---

## Phase 2: LiveKit Agent Scaffold + Gemini Live Session

**Goal**: A LiveKit agent answers calls, connects to Gemini Live, and can hold a basic conversation.

### 2.1 Agent Project Structure

```
livekit-agent/
├── src/
│   ├── agent.ts              # Main entry point (defineAgent + entry)
│   ├── prompt.ts             # System prompt builder (ported from agent-prompt.js)
│   ├── tools/
│   │   ├── index.ts          # Tool registry + exports
│   │   ├── check-availability.ts
│   │   ├── book-appointment.ts
│   │   ├── capture-lead.ts
│   │   ├── check-caller-history.ts
│   │   ├── transfer-call.ts
│   │   └── end-call.ts
│   ├── post-call.ts          # Post-call pipeline (ported from call-processor.js)
│   ├── supabase.ts           # Supabase service-role client
│   └── utils.ts              # Shared utilities (formatSlotForSpeech, etc.)
├── package.json
├── tsconfig.json
├── Dockerfile
├── livekit.toml
└── .env
```

### 2.2 Package Dependencies

```json
{
  "dependencies": {
    "@livekit/agents": "^1.0.0",
    "@livekit/agents-plugin-google": "^1.2.0",
    "@livekit/rtc-node": "^0.12.0",
    "livekit-server-sdk": "^2.9.0",
    "@supabase/supabase-js": "^2.45.0",
    "zod": "^3.23.0",
    "twilio": "^5.0.0",
    "resend": "^4.0.0",
    "stripe": "^17.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0"
  }
}
```

### 2.3 Agent Entry Point (`agent.ts`)

```typescript
import { type JobContext, type JobProcess, cli, defineAgent, voice } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { SipClient } from 'livekit-server-sdk';
import { buildSystemPrompt } from './prompt.js';
import { createTools } from './tools/index.js';
import { getSupabaseAdmin } from './supabase.js';
import { runPostCallPipeline } from './post-call.js';
import { calculateAvailableSlots } from './utils.js';

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    // Wait for the SIP participant (the caller) to join
    const participant = await ctx.waitForParticipant();

    // Extract phone numbers from SIP participant attributes
    const toNumber = participant.attributes?.['sip.phoneNumber']
      || participant.attributes?.['sip.to'];
    const fromNumber = participant.attributes?.['sip.callerNumber']
      || participant.attributes?.['sip.from'];
    const callId = ctx.room.name; // Room name = call identifier

    // ── Tenant lookup (same logic as handleInbound webhook) ──
    const supabase = getSupabaseAdmin();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('retell_phone_number', toNumber)
      .single();

    const onboardingComplete = tenant?.onboarding_complete ?? false;
    const businessName = tenant?.business_name ?? 'Voco';
    const locale = tenant?.default_locale ?? 'en';
    const tonePreset = tenant?.tone_preset ?? 'professional';
    const tenantId = tenant?.id ?? null;
    const ownerPhone = tenant?.owner_phone ?? null;
    const tenantTimezone = tenant?.tenant_timezone ?? 'America/Chicago';

    // ── Calculate available slots (same logic as handleInbound) ──
    let availableSlots = '';
    if (onboardingComplete && tenantId) {
      // Fetch appointments, calendar_events, service_zones, zone_travel_buffers
      // Calculate slots for today + next 2 days
      // Format as numbered list
      availableSlots = await calculateInitialSlots(supabase, tenant);
    }

    // ── Fetch intake questions ──
    let intakeQuestions = '';
    if (tenantId) {
      const { data: services } = await supabase
        .from('services')
        .select('intake_questions')
        .eq('tenant_id', tenantId)
        .eq('active', true);
      if (services) {
        intakeQuestions = services
          .flatMap(s => s.intake_questions || [])
          .join('\n');
      }
    }

    // ── Build system prompt ──
    let systemPrompt = buildSystemPrompt(locale, {
      business_name: businessName,
      onboarding_complete: onboardingComplete,
      tone_preset: tonePreset,
      intake_questions: intakeQuestions,
    });
    if (availableSlots) {
      systemPrompt += `\n\nAVAILABLE APPOINTMENT SLOTS:\n${availableSlots}`;
    }

    // ── Create call record immediately ──
    const startTimestamp = Date.now();
    const { data: callRecord } = await supabase
      .from('calls')
      .upsert({
        call_id: callId,
        tenant_id: tenantId,
        from_number: fromNumber,
        to_number: toNumber,
        direction: 'inbound',
        status: 'started',
        start_timestamp: startTimestamp,
      }, { onConflict: 'call_id' })
      .select('id')
      .single();

    // ── Create tools (in-process, direct Supabase access) ──
    const tools = createTools({
      supabase,
      tenant,
      tenantId,
      callId,
      callUuid: callRecord?.id,
      fromNumber,
      toNumber,
      ownerPhone,
      startTimestamp,
      onboardingComplete,
      tenantTimezone,
      ctx, // JobContext for SIP transfer
    });

    // ── Start Gemini Live session via LiveKit agent framework ──
    const agent = new voice.Agent({
      instructions: systemPrompt,
      tools,
    });

    const session = new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        model: 'gemini-3.1-flash-live-preview',
        voice: 'Kore', // Firm, professional voice — matches "professional" tone
        temperature: 0.3,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: {
          slidingWindow: {},
          triggerTokens: 100000,
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
            endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
            prefixPaddingMs: 100,
            silenceDurationMs: 700,
          },
          activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
        },
      }),
      // No separate STT/TTS — Gemini handles audio natively
    });

    // ── Collect transcript in real-time ──
    const transcriptTurns: Array<{ role: string; content: string; timestamp: number }> = [];

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const text = event.item.textContent;
      if (text) {
        transcriptTurns.push({
          role: event.item.role === 'user' ? 'user' : 'agent',
          content: text,
          timestamp: Date.now(),
        });
      }
    });

    // ── Start the session and generate greeting ──
    await session.start({ agent, room: ctx.room });
    await session.generateReply({ instructions: 'Generate your opening greeting now.' });

    // ── Start Egress recording ──
    const egressClient = new EgressClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
    );
    let egressId: string | undefined;
    try {
      const egressInfo = await egressClient.startRoomCompositeEgress(
        ctx.room.name!,
        {
          file: new EncodedFileOutput({
            filepath: `call-recordings/${callId}.mp4`,
            output: {
              case: 's3', // or Supabase Storage via S3-compatible endpoint
              value: {
                accessKey: process.env.SUPABASE_S3_ACCESS_KEY!,
                secret: process.env.SUPABASE_S3_SECRET_KEY!,
                bucket: 'call-recordings',
                region: process.env.SUPABASE_S3_REGION!,
                endpoint: process.env.SUPABASE_S3_ENDPOINT!,
                forcePathStyle: true,
              },
            },
          }),
        },
        { audioOnly: true },
      );
      egressId = egressInfo.egressId;
    } catch (err) {
      console.error('[agent] Failed to start egress:', err);
    }

    // ── Handle session end (post-call pipeline) ──
    session.on(voice.AgentSessionEventTypes.Close, async () => {
      const endTimestamp = Date.now();

      // Stop egress
      if (egressId) {
        try { await egressClient.stopEgress(egressId); } catch {}
      }

      // Run post-call pipeline
      await runPostCallPipeline({
        supabase,
        callId,
        callUuid: callRecord?.id,
        tenantId,
        tenant,
        fromNumber,
        toNumber,
        startTimestamp,
        endTimestamp,
        transcriptTurns,
        recordingStoragePath: `call-recordings/${callId}.mp4`,
      });
    });
  },
});
```

### 2.4 Voice Selection by Tone Preset

Map the existing `tone_preset` values to Gemini voices:

| `tone_preset` | Retell Behavior | Gemini Voice | Character |
|----------------|-----------------|--------------|-----------|
| `professional` | "measured and formal" | `Kore` | Firm |
| `friendly` | "upbeat and warm" | `Aoede` | Breezy |
| `local_expert` | "relaxed and neighborly" | `Achird` | Friendly |

Implement in agent.ts:
```typescript
const VOICE_MAP: Record<string, string> = {
  professional: 'Kore',
  friendly: 'Aoede',
  local_expert: 'Achird',
};
const voiceName = VOICE_MAP[tonePreset] || 'Kore';
```

### 2.5 Greeting Generation

**Current behavior**: server.js calls `handleResponseRequired()` with empty transcript → Groq generates greeting from system prompt.

**New behavior**: `session.generateReply({ instructions: 'Generate your opening greeting now.' })` triggers Gemini to speak the greeting based on the OPENING LINE section of the system prompt. Native audio means natural pacing, breathing, and intonation.

**Greeting guard removal**: The 9-second greeting guard in server.js exists because Retell's microphone picks up the AI's own TTS and transcribes it as user speech. LiveKit + Gemini handles this natively — Gemini's VAD distinguishes between its own output and caller input. The echo awareness prompt section is kept as a safety net but the timing guard is unnecessary.

### 2.6 Interruption Handling

**Current behavior**: Retell controls `interruption_sensitivity`. The system prompt has no-interruption rules for greeting/farewell.

**New behavior**: Gemini's built-in VAD handles barge-in natively via `activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'`. For greeting/farewell no-interruption:

Option A: Temporarily set `activityHandling: 'NO_INTERRUPTION'` during greeting/farewell (requires session reconfiguration — complex).

Option B: Keep the prompt-level instruction ("Complete your entire greeting without stopping") and trust Gemini to follow it. If interrupted, Gemini will pick up naturally. This is the simpler approach and is recommended.

**Recommendation**: Option B. The prompt instruction is a behavioral hint. If the caller genuinely needs to interrupt (e.g., repeat caller who doesn't need the greeting), Gemini should respond. The old guard was a workaround for echo, not a feature.

### 2.7 Deliverables

- [ ] `livekit-agent/` project scaffolded with dependencies
- [ ] Agent entry point connects to room, looks up tenant, opens Gemini session
- [ ] Gemini generates greeting from system prompt
- [ ] Basic conversation works (no tools yet)
- [ ] Egress recording starts on call connect
- [ ] Transcript collected via AgentSession events
- [ ] Test: Call Twilio number → hear AI greeting → have basic conversation

---

## Phase 3: System Prompt Port + Voice Configuration

**Goal**: Port the entire battle-tested agent prompt from `agent-prompt.js` to work with Gemini's native audio model.

### 3.1 Prompt Porting Strategy

The system prompt is text-based and model-agnostic. It ports directly to Gemini's `systemInstruction` with minimal changes. Key considerations:

| Prompt Section | Change Needed | Notes |
|----------------|---------------|-------|
| Core Identity | Minimal | Remove "speak at a moderate pace" — Gemini controls its own pacing natively |
| Personality/Tone | None | Works as-is with voice selection handling tone |
| Recording Notice | None | Text instruction, model-agnostic |
| Opening Line | Minor | Remove "Complete without stopping" workaround if not needed. Keep echo awareness. |
| Language Section | Minor | Gemini has native 97-language support. Simplify detection instruction. |
| Repeat Caller | None | Logic is in tool invocation, not voice-specific |
| Info Gathering | None | Behavioral instructions, model-agnostic |
| Intake Questions | None | Dynamic injection, same pattern |
| Booking Protocol | None | Business logic, model-agnostic |
| Decline Handling | None | Business logic, model-agnostic |
| Transfer Section | Minor | Update tool behavior description (no webhook round-trip) |
| Call Duration | None | Behavioral instruction, model-agnostic |
| Available Slots | None | Appended data, same format |

### 3.2 Prompt Adaptations for Native Audio

Add Gemini-specific instructions:

```
VOICE BEHAVIOR (native audio model):
- You process audio directly. Your voice, pacing, and emotional tone are part of your response.
- Match the caller's energy level — if they sound stressed, be calm and reassuring.
  If they sound casual, be relaxed and friendly.
- When reading back addresses, dates, or times, slow down naturally for clarity.
- Pause briefly between distinct information items (e.g., between slot options).
- If the caller sounds confused or frustrated, adjust your tone to be more patient.
```

Remove Groq-specific instructions:
- Remove references to "text-to-speech" or "TTS"
- Remove the 9-second greeting guard logic (handled by platform)
- Remove `max_tokens: 250` constraint (Gemini manages output length via audio)

### 3.3 Localization

The `messages/en.json` and `messages/es.json` files from the Retell-ws-server need to be copied into the LiveKit agent project. The `t()` translation function in `prompt.ts` works identically.

```
livekit-agent/
  src/
    messages/
      en.json
      es.json
    prompt.ts
```

### 3.4 Deliverables

- [ ] `prompt.ts` fully ported from `agent-prompt.js` with all sections
- [ ] Gemini-specific voice behavior instructions added
- [ ] Groq-specific workarounds removed
- [ ] Localization files copied and integrated
- [ ] Test: Conversation follows booking-first protocol, handles decline, language switch

---

## Phase 4: Tool Implementation (In-Process)

**Goal**: All 6 tools execute in-process inside the agent, with direct Supabase access. Zero webhook round-trips.

### 4.1 Tool Architecture Change

**Before (Retell)**:
```
Groq returns tool_call → server.js sends to Retell → Retell fires webhook to Next.js
→ Next.js handler queries Supabase → returns result → Retell forwards to server.js
→ server.js sends to Groq
```
Latency: ~500ms per tool call (4 network hops)

**After (LiveKit + Gemini)**:
```
Gemini returns tool_call → agent.ts executes handler → queries Supabase directly
→ returns result → Gemini continues
```
Latency: ~50ms per tool call (1 DB query)

### 4.2 Tool Definitions

All tools use LiveKit's `llm.tool()` with Zod schemas. The execute functions contain the exact same business logic as the current webhook handlers in `route.js`.

#### `check-availability.ts`

```typescript
import { llm } from '@livekit/agents';
import { z } from 'zod';
import { calculateAvailableSlots } from '../utils.js';

export function createCheckAvailabilityTool(deps: ToolDeps) {
  return llm.tool({
    description: 'Check real-time appointment availability for specific dates.',
    parameters: z.object({
      date: z.string().optional().describe('YYYY-MM-DD format. Omit for today + next 2 days.'),
      urgency: z.enum(['emergency', 'routine', 'high_ticket']).optional(),
    }),
    execute: async ({ date, urgency }) => {
      // Same logic as handleCheckAvailability in route.js:
      // 1. Fetch tenant scheduling config
      // 2. Parallel fetch: appointments, calendar_events, service_zones, zone_travel_buffers
      // 3. Calculate slots for requested date(s)
      // 4. Format as numbered list with human-readable times + ISO start/end
      // 5. Return slots or "no slots" message
    },
  });
}
```

#### `book-appointment.ts`

```typescript
export function createBookAppointmentTool(deps: ToolDeps) {
  return llm.tool({
    description: 'Book a confirmed appointment slot.',
    parameters: z.object({
      slot_start: z.string().describe('ISO 8601 datetime of appointment start'),
      slot_end: z.string().describe('ISO 8601 datetime of appointment end'),
      service_address: z.string().describe('Verbally confirmed service address'),
      caller_name: z.string().describe('Caller full name'),
      urgency: z.enum(['emergency', 'routine', 'high_ticket']).describe('Inferred from conversation'),
    }),
    execute: async ({ slot_start, slot_end, service_address, caller_name, urgency }) => {
      // Same logic as handleBookAppointment in route.js:
      // 1. Call atomicBookSlot() with all parameters
      // 2. On slot_taken: recalculate next available, return alternative speech
      // 3. On success:
      //    - Push to Google Calendar (async, non-blocking)
      //    - Write booking_outcome: 'booked' to calls record
      //    - Send caller SMS confirmation
      //    - Return confirmation speech
      // 4. On failure:
      //    - Write booking_outcome: 'attempted'
      //    - Send recovery SMS
      //    - Return fallback speech
    },
  });
}
```

#### `capture-lead.ts`

```typescript
export function createCaptureLeadTool(deps: ToolDeps) {
  return llm.tool({
    description: 'Capture caller info as a lead when they decline booking.',
    parameters: z.object({
      caller_name: z.string().describe('Caller full name'),
      phone: z.string().optional(),
      address: z.string().optional(),
      job_type: z.string().optional(),
      notes: z.string().optional(),
    }),
    execute: async ({ caller_name, phone, address, job_type, notes }) => {
      // Same logic as handleCaptureLead in route.js:
      // 1. Compute durationSeconds from startTimestamp
      // 2. Call createOrMergeLead() with all fields
      // 3. Write booking_outcome: 'declined' to calls record
      // 4. Return confirmation: "I've saved your information. {bizName} will reach out soon."
    },
  });
}
```

#### `check-caller-history.ts`

```typescript
export function createCheckCallerHistoryTool(deps: ToolDeps) {
  return llm.tool({
    description: 'Check caller history for repeat caller awareness. No parameters needed.',
    parameters: z.object({}),
    execute: async () => {
      // Same logic as handleCheckCallerHistory in route.js:
      // 1. Look up leads by tenant_id + from_number (most recent 3)
      // 2. Look up appointments by tenant_id + caller_phone (upcoming non-cancelled 3)
      // 3. Build natural-language summary
      // 4. Return: "First-time caller" or "Returning caller" with details
    },
  });
}
```

#### `transfer-call.ts`

```typescript
export function createTransferCallTool(deps: ToolDeps) {
  return llm.tool({
    description: 'Transfer the call to the business owner.',
    parameters: z.object({
      caller_name: z.string().optional(),
      job_type: z.string().optional(),
      urgency: z.enum(['emergency', 'routine', 'high_ticket']).optional(),
      summary: z.string().optional(),
      reason: z.enum(['caller_requested', 'clarification_limit']).optional(),
    }),
    execute: async ({ caller_name, job_type, urgency, summary, reason }, { ctx }) => {
      if (!deps.ownerPhone) {
        return 'transfer_unavailable';
      }

      // Write exception_reason to calls record
      const exceptionReason = reason || (summary?.toLowerCase().includes('requested') ? 'caller_requested' : 'clarification_limit');
      await deps.supabase
        .from('calls')
        .update({ exception_reason: exceptionReason })
        .eq('call_id', deps.callId);

      // Build whisper context (spoken by agent before transfer)
      const whisperContext = buildWhisperMessage({ callerName: caller_name, jobType: job_type, urgency, summary });

      // Perform SIP REFER transfer via LiveKit
      try {
        const sipClient = new SipClient(
          process.env.LIVEKIT_URL!,
          process.env.LIVEKIT_API_KEY!,
          process.env.LIVEKIT_API_SECRET!,
        );
        await sipClient.transferSipParticipant({
          participantIdentity: deps.sipParticipantIdentity,
          roomName: deps.roomName,
          transferTo: `tel:${deps.ownerPhone}`,
          playDialtone: true,
        });
        return 'transfer_initiated';
      } catch (err) {
        console.error('[agent] Transfer failed:', err);
        return 'transfer_failed';
      }
    },
  });
}
```

#### `end-call.ts`

```typescript
export function createEndCallTool(deps: ToolDeps) {
  return llm.tool({
    description: 'End the call gracefully after all actions are complete.',
    parameters: z.object({}),
    execute: async (_, { ctx }) => {
      // Gemini will generate the farewell from prompt instructions.
      // After farewell is spoken, disconnect the SIP participant.
      // Use a short delay to let the farewell play out.
      setTimeout(async () => {
        try {
          const roomService = new RoomServiceClient(
            process.env.LIVEKIT_URL!,
            process.env.LIVEKIT_API_KEY!,
            process.env.LIVEKIT_API_SECRET!,
          );
          await roomService.removeParticipant(deps.roomName, deps.sipParticipantIdentity);
        } catch {}
      }, 3000); // 3s delay for farewell to play

      return 'Call ending.';
    },
  });
}
```

### 4.3 Tool Dependencies Injection

All tools receive a shared `ToolDeps` object with everything they need:

```typescript
interface ToolDeps {
  supabase: SupabaseClient;
  tenant: TenantRow | null;
  tenantId: string | null;
  callId: string;
  callUuid: string | null;
  fromNumber: string;
  toNumber: string;
  ownerPhone: string | null;
  startTimestamp: number;
  onboardingComplete: boolean;
  tenantTimezone: string;
  roomName: string;
  sipParticipantIdentity: string;
  ctx: JobContext;
}
```

### 4.4 Conditional Tool Registration

Same pattern as current `getTools(onboardingComplete)`:

```typescript
export function createTools(deps: ToolDeps) {
  const tools: Record<string, ReturnType<typeof llm.tool>> = {
    transfer_call: createTransferCallTool(deps),
    capture_lead: createCaptureLeadTool(deps),
    end_call: createEndCallTool(deps),
    check_caller_history: createCheckCallerHistoryTool(deps),
  };

  if (deps.onboardingComplete) {
    tools.check_availability = createCheckAvailabilityTool(deps);
    tools.book_appointment = createBookAppointmentTool(deps);
  }

  return tools;
}
```

### 4.5 Shared Business Logic Imports

The following modules are imported directly from the Next.js app (or extracted into a shared package):

- `src/lib/scheduling/slot-calculator.js` → `calculateAvailableSlots()`
- `src/lib/scheduling/booking.js` → `atomicBookSlot()`
- `src/lib/scheduling/google-calendar.js` → `pushBookingToCalendar()`
- `src/lib/leads.js` → `createOrMergeLead()`
- `src/lib/notifications.js` → `sendCallerSMS()`, `sendCallerRecoverySMS()`
- `src/lib/whisper-message.js` → `buildWhisperMessage()`

**Strategy**: Either:
1. **Symlink / npm workspace**: If the agent lives in the same monorepo, use workspace imports
2. **Copy + adapt**: Copy the needed modules into `livekit-agent/src/lib/` and adjust imports
3. **Shared npm package**: Extract into `@voco/core` (overkill for now)

**Recommendation**: Option 2 (copy + adapt) for simplicity. These modules are stable and rarely change.

### 4.6 Chained Tool Calls

**Current behavior**: server.js `handleToolResult()` checks if Groq returns another tool call after processing a tool result (e.g., `capture_lead` → `end_call` chain).

**New behavior**: Gemini Live handles chained tool calls natively. The agent framework sends tool results back to Gemini, and Gemini can invoke another tool in the same turn. No special handling needed.

### 4.7 Deliverables

- [ ] All 6 tools implemented with `llm.tool()` + Zod schemas
- [ ] Tool logic matches current webhook handler behavior exactly
- [ ] Conditional tool registration (booking tools gated by onboarding_complete)
- [ ] Shared business logic modules available to agent
- [ ] SIP REFER transfer working for transfer_call
- [ ] end_call disconnects SIP participant after farewell
- [ ] Test: Full booking flow (check availability → select slot → book) works
- [ ] Test: Decline flow (first decline → second decline → capture_lead → end_call) works
- [ ] Test: Transfer flow (caller requests human → transfer_call → SIP REFER) works

---

## Phase 5: Post-Call Pipeline + Recording + Transcripts

**Goal**: After each call, run the same post-call pipeline (triage, lead creation, notifications, usage tracking) and store recording + transcript.

### 5.1 Post-Call Pipeline Port

The post-call pipeline currently runs in two stages:
1. `processCallEnded()` — lightweight, runs on `call_ended` webhook
2. `processCallAnalyzed()` — heavy, runs on `call_analyzed` webhook (minutes later)

In the new system, **both run in-process** when the AgentSession closes. There is no delay — recording and transcript are available immediately.

```typescript
// post-call.ts
export async function runPostCallPipeline(params: PostCallParams) {
  const {
    supabase, callId, callUuid, tenantId, tenant,
    fromNumber, toNumber, startTimestamp, endTimestamp,
    transcriptTurns, recordingStoragePath,
  } = params;

  const durationSeconds = Math.round((endTimestamp - startTimestamp) / 1000);

  // ── 1. Build transcript data ──
  const transcriptText = transcriptTurns
    .map(t => `${t.role === 'user' ? 'Caller' : 'AI'}: ${t.content}`)
    .join('\n');

  const transcriptStructured = transcriptTurns.map(t => ({
    role: t.role,
    content: t.content,
    // words array not available from Gemini transcription — omit
  }));

  // ── 2. Update call record ──
  const { data: updatedCall } = await supabase
    .from('calls')
    .update({
      status: 'analyzed', // Skip 'ended' intermediate state — go straight to analyzed
      end_timestamp: endTimestamp,
      recording_storage_path: recordingStoragePath,
      transcript_text: transcriptText,
      transcript_structured: transcriptStructured,
      disconnection_reason: 'agent_hangup', // or 'caller_hangup' based on who disconnected
    })
    .eq('call_id', callId)
    .select('id, booking_outcome')
    .single();

  const callUuidFinal = updatedCall?.id || callUuid;

  // ── 3. Test call auto-cancel ──
  // Check if this was a test call (metadata flag set during test-call initiation)
  const isTestCall = params.isTestCall ?? false;
  if (isTestCall && tenantId) {
    const { data: testAppt } = await supabase
      .from('appointments')
      .select('id')
      .eq('call_id', callUuidFinal)
      .eq('tenant_id', tenantId)
      .single();

    if (testAppt) {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', testAppt.id);
      await supabase.from('leads')
        .update({ status: 'new', appointment_id: null })
        .eq('appointment_id', testAppt.id);
    }
  }

  // ── 4. Usage tracking ──
  if (!isTestCall && tenantId && durationSeconds >= 10) {
    try {
      const { data: rpcResult } = await supabase.rpc('increment_calls_used', {
        p_tenant_id: tenantId,
        p_call_id: callId,
      });
      if (rpcResult?.success && rpcResult?.limit_exceeded) {
        // Report overage to Stripe (same logic as processCallEnded)
        await reportOverageToStripe(supabase, tenantId);
      }
    } catch (err) {
      console.error('[post-call] Usage tracking error (non-fatal):', err);
    }
  }

  // ── 5. Language barrier detection ──
  const detectedLanguage = detectLanguageFromTranscript(transcriptTurns);
  const SUPPORTED_LANGUAGES = ['en', 'es'];
  const languageBarrier = detectedLanguage && !SUPPORTED_LANGUAGES.includes(detectedLanguage);

  // ── 6. Triage classification ──
  const { urgency, confidence, layerUsed } = await classifyUrgency(transcriptText, tenantId, supabase);

  // ── 7. Calculate suggested slots for unbooked calls ──
  let suggestedSlots = null;
  const bookingOutcome = updatedCall?.booking_outcome;
  if (!bookingOutcome || bookingOutcome === 'not_attempted') {
    suggestedSlots = await calculateSuggestedSlots(supabase, tenant);
  }

  // ── 8. Update call with triage + language data ──
  const notificationPriority = (urgency === 'emergency' || urgency === 'high_ticket') ? 'high' : 'standard';
  await supabase.from('calls').update({
    urgency_classification: urgency,
    urgency_confidence: confidence,
    triage_layer_used: layerUsed,
    detected_language: detectedLanguage,
    language_barrier: languageBarrier,
    barrier_language: languageBarrier ? detectedLanguage : null,
    suggested_slots: suggestedSlots,
    notification_priority: notificationPriority,
  }).eq('call_id', callId);

  // Set booking_outcome to not_attempted if still null
  await supabase.from('calls')
    .update({ booking_outcome: 'not_attempted' })
    .eq('call_id', callId)
    .is('booking_outcome', null);

  // ── 9. Create/merge lead ──
  if (callUuidFinal && durationSeconds >= 15) {
    try {
      await createOrMergeLead({
        supabase,
        tenantId,
        callId: callUuidFinal, // UUID, not string
        fromNumber,
        callerName: extractCallerName(transcriptTurns),
        jobType: extractJobType(transcriptTurns),
        urgency,
        // ... other fields extracted from transcript
      });
    } catch (err) {
      console.error('[post-call] Lead creation error:', err);
    }
  }

  // ── 10. Send owner notifications ──
  if (tenantId && tenant) {
    const prefs = tenant.notification_preferences || {
      booked: { sms: true, email: true },
      declined: { sms: false, email: false },
      not_attempted: { sms: false, email: false },
      attempted: { sms: false, email: false },
    };

    const outcome = bookingOutcome || 'not_attempted';
    const outcomePref = prefs[outcome] || { sms: false, email: false };
    const isEmergency = urgency === 'emergency';

    if (outcomePref.sms || isEmergency) {
      await sendOwnerSMS(/* same params as current */);
    }
    if (outcomePref.email || isEmergency) {
      await sendOwnerEmail(/* same params as current */);
    }
  }
}
```

### 5.2 Recording Pipeline

**Current flow**: Retell CDN → `processCallAnalyzed()` downloads WAV → uploads to Supabase Storage → stores path in `recording_storage_path`.

**New flow**: LiveKit Egress records directly to Supabase Storage (S3-compatible endpoint) during the call. When the call ends, the file is already in storage.

**Supabase Storage S3 compatibility**: Supabase Storage exposes an S3-compatible API. Configure Egress with:
- `endpoint`: `https://<project-ref>.supabase.co/storage/v1/s3`
- `bucket`: `call-recordings`
- `accessKey` / `secret`: From Supabase dashboard → Storage → S3 Access Keys

**Alternative**: If Supabase S3 compatibility is unreliable, use LiveKit's webhook to be notified when egress completes, then download and upload manually (similar to current flow but from LiveKit instead of Retell).

### 5.3 Transcript Pipeline

**Current flow**: Retell provides `transcript` in `call_analyzed` webhook → stored as `transcript_text` (plain) and `transcript_structured` (with word-level timestamps).

**New flow**: Gemini provides real-time transcription via `inputAudioTranscription` and `outputAudioTranscription`. The agent collects these via `ConversationItemAdded` events during the call.

**Structured transcript format**: The dashboard's `TranscriptViewer.jsx` expects:
```json
[
  { "role": "agent", "content": "Hello, thank you for calling..." },
  { "role": "user", "content": "Hi, I have a leaking pipe..." }
]
```

This format is maintained by collecting `ConversationItemAdded` events.

**Note**: Gemini's transcription may not include word-level timestamps (`words` array with `start`/`end` per word). The current `TranscriptViewer` only uses `role` and `content`, so this is fine.

### 5.4 Triage Classification

The 3-layer triage pipeline (`src/lib/triage/`) is Retell-independent:
- Layer 1 (keywords): regex on transcript text ✓
- Layer 2 (LLM): Groq with JSON mode — **needs migration to Gemini or keep Groq**
- Layer 3 (owner rules): Supabase query ✓

**Decision**: Keep Layer 2 using Groq for now (separate from the voice model). The triage LLM call is a simple JSON-mode classification, not a real-time voice task. Groq is fast and cheap for this. Alternatively, use the `@google/genai` SDK to call Gemini Flash (non-live) for classification.

### 5.5 Deliverables

- [ ] `post-call.ts` implements full pipeline (triage, leads, notifications, usage)
- [ ] Recording stored in Supabase Storage via Egress
- [ ] Transcript collected and stored in correct format
- [ ] Test call auto-cancel working
- [ ] Usage tracking + overage billing working
- [ ] Owner notifications (SMS + email) sent correctly
- [ ] Recovery SMS cron still works (no changes needed — reads from `calls` table)
- [ ] Test: Full call → check calls table has all data → check lead created → check notifications sent

---

## Phase 6: Database Migration + Dashboard Updates

**Goal**: Schema changes to accommodate LiveKit/Gemini identifiers while preserving existing data. Dashboard updated to work with new recording/transcript sources.

### 6.1 Database Migration (`023_livekit_migration.sql`)

```sql
-- Migration: Retell → LiveKit/Gemini voice system
-- Changes call identifier from retell_call_id to call_id (generic)
-- Preserves all existing data

-- 1. Rename retell_call_id to call_id (generic identifier)
-- The column stores LiveKit room name for new calls, Retell call ID for historical calls
ALTER TABLE calls RENAME COLUMN retell_call_id TO call_id;

-- 2. Drop the NOT NULL constraint on call_id
-- Historical Retell call IDs remain. New LiveKit calls use room name.
-- The UNIQUE constraint is preserved.
ALTER TABLE calls ALTER COLUMN call_id DROP NOT NULL;

-- 3. Rename retell_metadata to call_metadata (generic)
ALTER TABLE calls RENAME COLUMN retell_metadata TO call_metadata;

-- 4. Update indexes
DROP INDEX IF EXISTS idx_calls_retell_call_id;
CREATE INDEX idx_calls_call_id ON calls(call_id);

-- 5. Rename retell_phone_number to phone_number on tenants
-- This column already stores Twilio numbers for US/CA tenants.
-- After migration, ALL numbers are Twilio (no Retell import step).
ALTER TABLE tenants RENAME COLUMN retell_phone_number TO phone_number;

-- 6. Add call_provider column to distinguish historical vs new calls
ALTER TABLE calls ADD COLUMN call_provider text DEFAULT 'livekit'
  CHECK (call_provider IN ('retell', 'livekit'));

-- 7. Backfill: all existing calls are from Retell
UPDATE calls SET call_provider = 'retell' WHERE call_provider IS NULL OR call_provider = 'livekit';
-- Reset default for new calls
ALTER TABLE calls ALTER COLUMN call_provider SET DEFAULT 'livekit';

-- 8. Add column for LiveKit egress ID (useful for debugging)
ALTER TABLE calls ADD COLUMN egress_id text;
```

### 6.2 Code References to Update

Every reference to `retell_call_id` in the codebase must be updated to `call_id`:

| File | Change |
|------|--------|
| `src/app/api/webhooks/retell/route.js` | **REMOVED** (entire file deleted in Phase 8) |
| `src/lib/call-processor.js` | **REMOVED** (logic moved to agent `post-call.ts`) |
| `src/app/api/calls/route.js` | Update query: `.select('..., call_id, ...')` |
| `src/app/api/leads/[id]/route.js` | Update join: `lead_calls(calls(..., call_id, ...))` |
| `src/app/dashboard/calls/page.js` | Already uses field names from API response — no change if API serializes correctly |
| `src/app/api/cron/send-recovery-sms/route.js` | Update query column name |

Every reference to `retell_phone_number` must be updated to `phone_number`:

| File | Change |
|------|--------|
| `src/app/api/webhooks/retell/route.js` | **REMOVED** |
| `src/lib/call-processor.js` | **REMOVED** |
| `src/app/api/onboarding/*` | Update all queries |
| `src/app/api/stripe/webhook/route.js` | Update provisioning queries |
| `src/components/dashboard/settings/*` | Update AI Voice settings display |
| Setup checklist component | Update phone number check |

Every reference to `retell_metadata` must be updated to `call_metadata`:

| File | Change |
|------|--------|
| `src/lib/call-processor.js` | **REMOVED** |
| Any analytics queries | Update column name |

### 6.3 Dashboard Component Updates

#### `AudioPlayer.jsx`

**Current**: Plays from `recording_url` (Retell CDN URL).
**Issue**: `LeadFlyout.jsx` passes `firstCall?.recording_url` to AudioPlayer.
**After migration**: New calls have `recording_storage_path` but not `recording_url`. Historical calls have `recording_url`.

**Fix**: Update LeadFlyout to prefer storage path with signed URL:

```javascript
// In LeadFlyout.jsx
const getRecordingUrl = async (call) => {
  // New calls: use Supabase Storage signed URL
  if (call.recording_storage_path) {
    const { data } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(call.recording_storage_path, 3600); // 1 hour
    return data?.signedUrl;
  }
  // Historical calls: use Retell CDN URL
  return call.recording_url;
};
```

#### `TranscriptViewer.jsx`

**No changes needed**. It already handles both `transcript_structured` (array of `{role, content}`) and `transcript_text` (plain text fallback). The new Gemini transcript format matches the expected structure.

#### `calls/page.js`

**Current**: `const hasRecording = !!(call.recording_url || call.recording_storage_path);`
**No changes needed** — this already checks both fields.

#### AI Voice Settings Page

Update label from "Retell Phone Number" to "Phone Number" or "AI Phone Number". The underlying field changes from `retell_phone_number` to `phone_number`.

#### Setup Checklist

Update the check from `tenant.retell_phone_number` to `tenant.phone_number`.

### 6.4 Deliverables

- [ ] Migration `023_livekit_migration.sql` created and tested
- [ ] All code references to `retell_call_id` updated to `call_id`
- [ ] All code references to `retell_phone_number` updated to `phone_number`
- [ ] All code references to `retell_metadata` updated to `call_metadata`
- [ ] AudioPlayer uses signed URLs for Supabase Storage recordings
- [ ] Historical Retell recordings still play via `recording_url`
- [ ] AI Voice Settings page updated
- [ ] Setup checklist updated
- [ ] Test: Dashboard shows both historical (Retell) and new (LiveKit) calls correctly
- [ ] Test: Audio playback works for both old and new recordings

---

## Phase 7: Onboarding Flow + Phone Provisioning Changes

**Goal**: Update onboarding to work without Retell. Phone provisioning becomes pure Twilio. Test calls use LiveKit outbound SIP.

### 7.1 Phone Provisioning Changes

**Current flow** (in `src/app/api/stripe/webhook/route.js` on `checkout.session.completed`):
1. **US/CA**: Buy number via Twilio API → import into Retell via `retell.phoneNumber.import()`
2. **SG**: Assign from inventory → import into Retell

**New flow**:
1. **US/CA**: Buy number via Twilio API → associate with Twilio Elastic SIP trunk (no Retell import)
2. **SG**: Assign from inventory → associate with Twilio Elastic SIP trunk

**Implementation**:

```javascript
// In stripe webhook handler, after purchasing Twilio number:

// OLD: Import to Retell
// await retell.phoneNumber.import({
//   phone_number: purchasedNumber,
//   termination_uri: process.env.RETELL_SIP_TRUNK_TERMINATION_URI,
// });

// NEW: Update Twilio number to route via SIP trunk
// (Elastic SIP Trunking routes all associated numbers automatically)
// Just save the number to the tenant — SIP trunk routing is configured at trunk level
await supabase
  .from('tenants')
  .update({ phone_number: purchasedNumber })
  .eq('id', tenantId);

// Also update the LiveKit inbound trunk to include this number
// (LiveKit needs to know which numbers to accept)
// Option A: Use a wildcard/catch-all dispatch rule (simpler)
// Option B: Update the trunk via LiveKit API to add the new number
```

**LiveKit trunk number management**: Rather than updating the trunk config every time a new number is provisioned, use a **catch-all dispatch rule** that accepts any number from the Twilio SIP trunk. The agent determines the tenant by querying `tenants.phone_number` matching the dialed number. This matches the current architecture where `handleInbound` looks up the tenant by `to_number`.

### 7.2 Test Call Changes

**Current flow** (`src/app/api/onboarding/test-call/route.js`):
```javascript
await retell.call.createPhoneCall({
  from_number: tenant.retell_phone_number,
  to_number: ownerPhone,
  retell_llm_dynamic_variables: { test_call: 'true', ... },
});
```

**New flow**: Use LiveKit SIP outbound to initiate a call:

```javascript
// In test-call/route.js
import { SipClient, RoomServiceClient } from 'livekit-server-sdk';

const sipClient = new SipClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET,
);

// Create a room for the test call
const roomName = `test-call-${tenantId}-${Date.now()}`;

// Create the room with metadata so the agent knows it's a test call
const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET,
);
await roomService.createRoom({
  name: roomName,
  metadata: JSON.stringify({
    test_call: true,
    tenant_id: tenantId,
    to_number: tenant.phone_number,
  }),
});

// Initiate outbound call to owner's phone
await sipClient.createSipParticipant(
  process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID,
  ownerPhone,
  roomName,
  {
    participantIdentity: `caller-${ownerPhone}`,
    participantName: 'Test Caller',
    waitUntilAnswered: true,
    playDialtone: true,
  },
);
```

The agent detects the test call via room metadata and passes `test_call: true` to the post-call pipeline for auto-cancel.

### 7.3 Provision Number Route

**Current** (`src/app/api/onboarding/provision-number/route.js`):
- US/CA: Twilio purchase → Retell import
- SG: Inventory assignment → Retell import

**New**: Remove all Retell import steps. Keep Twilio purchase and inventory assignment.

### 7.4 Deliverables

- [ ] Stripe webhook provisions numbers without Retell import
- [ ] Test call uses LiveKit SIP outbound instead of `retell.call.createPhoneCall()`
- [ ] Test call auto-cancel still works (metadata flag check)
- [ ] Provision-number route updated (no Retell import)
- [ ] Test: New signup → checkout → number provisioned → test call rings owner's phone
- [ ] Test: Test call creates appointment → auto-cancelled after call ends

---

## Phase 8: Cleanup + Cutover + Testing

**Goal**: Remove all Retell dependencies, verify everything works, deploy to production.

### 8.1 Files to Remove

| File | Reason |
|------|--------|
| `src/lib/retell.js` | Retell SDK singleton — no longer needed |
| `src/app/api/webhooks/retell/route.js` | All webhook handling moved to agent |
| `retell-sdk` from `package.json` | SDK dependency |

### 8.2 Environment Variables to Remove

| Variable | Reason |
|----------|--------|
| `RETELL_API_KEY` | No longer calling Retell API |
| `RETELL_SIP_TRUNK_TERMINATION_URI` | No longer importing numbers to Retell |

### 8.3 Environment Variables to Add

| Variable | Purpose |
|----------|---------|
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API authentication |
| `LIVEKIT_API_SECRET` | LiveKit API authentication |
| `GOOGLE_API_KEY` | Gemini Live API key |
| `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` | For outbound test calls |
| `SUPABASE_S3_ACCESS_KEY` | For Egress → Supabase Storage |
| `SUPABASE_S3_SECRET_KEY` | For Egress → Supabase Storage |
| `SUPABASE_S3_ENDPOINT` | Supabase Storage S3 endpoint |
| `SUPABASE_S3_REGION` | Supabase Storage region |

### 8.4 The Retell-ws-server Repository

The standalone Railway WebSocket server (`Retell-ws-server/`) is replaced by the LiveKit agent. After cutover:
1. Stop the Railway service
2. Archive the repository
3. Do not delete immediately — keep for reference

### 8.5 Testing Strategy

#### Unit Tests

| Test | What it verifies |
|------|-----------------|
| Tool handlers | Each tool produces correct Supabase writes and returns correct speech |
| Prompt builder | All sections generated correctly for each locale/tone/onboarding state |
| Post-call pipeline | Triage, lead creation, notification dispatch, usage tracking |
| Transcript collection | Correct format for TranscriptViewer |

#### Integration Tests

| Test | What it verifies |
|------|-----------------|
| Inbound call → tenant lookup | Agent finds correct tenant by dialed number |
| Booking flow | check_availability → book_appointment → calendar sync → SMS |
| Decline flow | Two declines → capture_lead → end_call |
| Transfer flow | SIP REFER → owner phone rings (or fallback) |
| Test call flow | Outbound SIP → conversation → auto-cancel |
| Recording + transcript | Egress uploads to Supabase Storage, transcript stored correctly |
| Dashboard display | Calls list, lead flyout, audio player, transcript viewer all work |

#### End-to-End Tests

1. **New tenant signup**: Create account → onboarding → checkout → number provisioned → test call works
2. **Inbound booking call**: Dial Twilio number → AI answers → book appointment → check dashboard
3. **Inbound no-book call**: Dial → decline booking → lead captured → recovery SMS sent
4. **Transfer call**: Dial → request human → SIP REFER to owner
5. **Emergency call**: Dial → describe emergency → urgency detection → immediate SMS/email
6. **Historical data**: Verify old Retell calls still display correctly in dashboard

#### Load Testing

- Simulate 10 concurrent calls to verify LiveKit Cloud scaling
- Verify Supabase connection pooling handles concurrent tool executions
- Monitor Gemini API rate limits and latency

### 8.6 Test Mock Updates

Current test mocks (`tests/__mocks__/retell.js`) should be replaced with LiveKit mocks:

```javascript
// tests/__mocks__/livekit.js
export const mockSipClient = {
  createSipParticipant: jest.fn(),
  transferSipParticipant: jest.fn(),
};
export const mockEgressClient = {
  startRoomCompositeEgress: jest.fn(),
  stopEgress: jest.fn(),
};
export const mockRoomService = {
  createRoom: jest.fn(),
  removeParticipant: jest.fn(),
};
```

### 8.7 Cutover Plan

This is a **full cutover**, not incremental. Reason: phone number routing is binary — a number either routes to Retell or to LiveKit via Twilio SIP trunk, not both.

**Cutover steps** (scheduled during low-traffic hours):

1. **Pre-cutover**:
   - Deploy LiveKit agent to LiveKit Cloud (or Railway)
   - Verify agent starts and registers with LiveKit
   - Run all tests against staging environment
   - Notify team of cutover window

2. **Cutover execution** (~30 minutes):
   - `[0:00]` Stop accepting new calls (optional: set Twilio to voicemail temporarily)
   - `[0:05]` Run database migration `023_livekit_migration.sql`
   - `[0:10]` Deploy updated Next.js app (with column renames, no Retell webhook)
   - `[0:15]` Unimport all numbers from Retell (Retell API or dashboard)
   - `[0:18]` Verify Twilio numbers are associated with the Elastic SIP trunk
   - `[0:20]` Verify LiveKit inbound trunk is configured
   - `[0:22]` Test call to one number — verify LiveKit agent answers
   - `[0:25]` Test full booking flow
   - `[0:28]` Re-enable call routing (remove voicemail if set)
   - `[0:30]` Monitor first few live calls

3. **Post-cutover** (next 24 hours):
   - Monitor error logs in LiveKit Cloud dashboard
   - Monitor Supabase for correct data writes
   - Verify dashboard displays new calls correctly
   - Check that recovery SMS cron still works
   - Verify Google Calendar sync
   - Stop Railway WebSocket server

4. **Rollback plan**: If critical issues arise:
   - Re-import numbers to Retell (API or dashboard)
   - Revert Next.js deployment (git revert + deploy)
   - Revert database migration (rename columns back)
   - Restart Railway WebSocket server
   - Timeline: ~15 minutes to rollback

### 8.8 Skill File Updates

After successful cutover, update these skill files:

| Skill | Changes |
|-------|---------|
| `voice-call-architecture` | Complete rewrite: LiveKit agent architecture, Gemini Live, SIP, in-process tools |
| `onboarding-flow` | Update provisioning flow (no Retell import), test call via LiveKit SIP |
| `auth-database-multitenancy` | Update column names (call_id, phone_number, call_metadata), new migration |
| `dashboard-crm-system` | Update recording playback (signed URLs), note transcript source change |

### 8.9 Deliverables

- [ ] `src/lib/retell.js` removed
- [ ] `src/app/api/webhooks/retell/route.js` removed
- [ ] `retell-sdk` removed from package.json
- [ ] All Retell env vars removed
- [ ] All LiveKit env vars configured
- [ ] Test mocks updated
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Load test passes (10 concurrent calls)
- [ ] Cutover executed successfully
- [ ] Historical data displays correctly
- [ ] Skill files updated

---

## Environment Variables

### New Variables (LiveKit Agent Service)

| Variable | Example | Purpose |
|----------|---------|---------|
| `LIVEKIT_URL` | `wss://voco.livekit.cloud` | LiveKit Cloud endpoint |
| `LIVEKIT_API_KEY` | `APIxxxxxxxxxx` | LiveKit auth |
| `LIVEKIT_API_SECRET` | `xxxxxxxxxxxxxxxxxx` | LiveKit auth |
| `GOOGLE_API_KEY` | `AIzaxxxxxxxxxxxxxxx` | Gemini Live API |
| `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` | `ST_xxxxxxxxx` | Outbound SIP trunk |
| `SUPABASE_URL` | (existing) | Direct Supabase access from agent |
| `SUPABASE_SERVICE_ROLE_KEY` | (existing) | Service role for bypassing RLS |
| `TWILIO_ACCOUNT_SID` | (existing) | SMS notifications |
| `TWILIO_AUTH_TOKEN` | (existing) | SMS auth |
| `TWILIO_FROM_NUMBER` | (existing) | SMS sender |
| `RESEND_API_KEY` | (existing) | Email notifications |
| `GROQ_API_KEY` | (existing) | Layer 2 triage LLM |
| `STRIPE_SECRET_KEY` | (existing) | Overage billing |
| `GOOGLE_CLIENT_ID` | (existing) | Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | (existing) | Calendar OAuth |
| `NEXT_PUBLIC_APP_URL` | (existing) | Links in notifications |

### Variables to Remove (Next.js)

| Variable | Reason |
|----------|--------|
| `RETELL_API_KEY` | No Retell SDK calls |
| `RETELL_SIP_TRUNK_TERMINATION_URI` | No Retell number import |

### Variables to Add (Next.js)

| Variable | Purpose |
|----------|---------|
| `LIVEKIT_URL` | For test-call route (SIP outbound) |
| `LIVEKIT_API_KEY` | For test-call route |
| `LIVEKIT_API_SECRET` | For test-call route |
| `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` | For test-call route |

---

## Rollout Strategy

### Why Full Cutover (Not Incremental)

Phone number routing is binary — a Twilio number either routes through Retell's SIP termination URI or through the LiveKit SIP trunk. There's no way to route some calls to Retell and some to LiveKit for the same number.

**Tenant-level incremental migration IS possible** if we:
1. Move one tenant's number from Retell to LiveKit at a time
2. Keep both systems running during migration period

**Recommendation**: Tenant-by-tenant migration is the safest approach:
1. Migrate the team's own test tenant first
2. Migrate 2-3 friendly beta tenants
3. Migrate remaining tenants in batches
4. Keep Retell running until all tenants are migrated
5. Decommission Retell after last tenant migrated

This requires keeping both the Retell webhook handler and the LiveKit agent running simultaneously, with the `call_provider` column distinguishing between the two.

---

## Cost Analysis

### Current Costs (Retell + Groq)

| Service | Cost | Notes |
|---------|------|-------|
| Retell | $0.07-0.15/min | Telephony + STT + TTS |
| Groq | ~$0.001/call | Llama 4 Scout inference |
| Railway | ~$5/mo | WebSocket server hosting |
| **Total** | **~$0.08-0.15/min** | |

### New Costs (Twilio + LiveKit + Gemini)

| Service | Cost | Notes |
|---------|------|-------|
| Twilio SIP | ~$0.004/min | Elastic SIP Trunking |
| LiveKit Cloud | ~$0.02/min | SIP + rooms + egress |
| Gemini 3.1 Flash Live | ~$0.023/min | Audio in ($0.005/min) + audio out ($0.018/min) |
| Groq | ~$0.001/call | Layer 2 triage only |
| **Total** | **~$0.047/min** | |

**Savings**: ~40-70% cost reduction, plus higher quality and lower latency.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Gemini Live session drops mid-call | Call lost | Medium | Enable `sessionResumption` + `contextWindowCompression`. Agent reconnects automatically. |
| Gemini function calling latency spikes | Slow tool responses | Low | Tools execute in-process (no network). Only risk is Supabase query latency. |
| LiveKit SIP service outage | No calls answered | Low | LiveKit Cloud SLA. Fallback: Twilio voicemail or webhook redirect. |
| Audio quality regression | Worse caller experience | Low | Gemini native audio is higher quality than STT→LLM→TTS. Test extensively before cutover. |
| Gemini 3.1 Flash Live is preview | May change before GA | Medium | Monitor Google release notes. Model swap is config-only (one line change). Fallback to `gemini-2.5-flash-native-audio` if needed. |
| SIP REFER transfer not supported by Twilio trunk | Can't transfer calls | Low | Verify during Phase 1 setup. Fallback: Use LiveKit warm transfer (two-room pattern). |
| Supabase S3 endpoint incompatible with Egress | Recordings not stored | Medium | Test early in Phase 2. Fallback: Egress to AWS S3 → post-process upload to Supabase. |
| Gemini prompt behavior differs from Groq | Different AI behavior | Medium | Extensive testing of all conversation flows. Adjust prompt wording for Gemini's style. |
| Concurrent Supabase connections from agent | Pool exhaustion | Low | Agent uses service_role client with connection pooling. Monitor pool usage. |
| 10-minute call with many tool calls exceeds Gemini context | Context overflow | Low | `contextWindowCompression` with `triggerTokens: 100000` handles this. |

---

## Appendix: File-by-File Change Tracker

| File | Action | Phase | Notes |
|------|--------|-------|-------|
| `livekit-agent/src/agent.ts` | Create | 2 | Main entry point |
| `livekit-agent/src/prompt.ts` | Create | 3 | Port from agent-prompt.js |
| `livekit-agent/src/tools/index.ts` | Create | 4 | Tool registry |
| `livekit-agent/src/tools/check-availability.ts` | Create | 4 | Port from route.js |
| `livekit-agent/src/tools/book-appointment.ts` | Create | 4 | Port from route.js |
| `livekit-agent/src/tools/capture-lead.ts` | Create | 4 | Port from route.js |
| `livekit-agent/src/tools/check-caller-history.ts` | Create | 4 | Port from route.js |
| `livekit-agent/src/tools/transfer-call.ts` | Create | 4 | Port from route.js |
| `livekit-agent/src/tools/end-call.ts` | Create | 4 | Port from route.js |
| `livekit-agent/src/post-call.ts` | Create | 5 | Port from call-processor.js |
| `livekit-agent/src/supabase.ts` | Create | 2 | Service-role client |
| `livekit-agent/src/utils.ts` | Create | 2 | Shared utilities |
| `livekit-agent/src/messages/en.json` | Copy | 3 | From Retell-ws-server |
| `livekit-agent/src/messages/es.json` | Copy | 3 | From Retell-ws-server |
| `livekit-agent/package.json` | Create | 2 | Dependencies |
| `livekit-agent/tsconfig.json` | Create | 2 | TypeScript config |
| `livekit-agent/Dockerfile` | Create | 2 | For deployment |
| `livekit-agent/livekit.toml` | Create | 2 | LiveKit Cloud config |
| `supabase/migrations/023_livekit_migration.sql` | Create | 6 | Schema changes |
| `src/app/api/onboarding/test-call/route.js` | Modify | 7 | LiveKit SIP outbound |
| `src/app/api/onboarding/provision-number/route.js` | Modify | 7 | Remove Retell import |
| `src/app/api/stripe/webhook/route.js` | Modify | 7 | Remove Retell import |
| `src/components/dashboard/AudioPlayer.jsx` | Modify | 6 | Signed URL fallback |
| `src/components/dashboard/LeadFlyout.jsx` | Modify | 6 | Recording URL logic |
| `src/app/dashboard/calls/page.js` | Minor | 6 | Column name updates |
| `src/app/api/calls/route.js` | Modify | 6 | Column name updates |
| `src/app/api/leads/[id]/route.js` | Modify | 6 | Column name updates |
| `src/app/api/cron/send-recovery-sms/route.js` | Modify | 6 | Column name updates |
| Dashboard settings (AI Voice) | Modify | 6 | Label updates |
| Setup checklist component | Modify | 6 | Field name update |
| `src/lib/retell.js` | Delete | 8 | No longer needed |
| `src/app/api/webhooks/retell/route.js` | Delete | 8 | Replaced by agent |
| `src/lib/call-processor.js` | Delete | 8 | Logic moved to agent |
| `package.json` | Modify | 8 | Remove retell-sdk, add livekit-server-sdk |
| `tests/__mocks__/retell.js` | Delete | 8 | Replace with LiveKit mocks |

---

## Appendix: Unchanged Files (Verified)

These files are explicitly preserved without modification:

- `src/lib/scheduling/slot-calculator.js` — Pure slot calculation
- `src/lib/scheduling/booking.js` — Atomic booking RPC
- `src/lib/scheduling/google-calendar.js` — Calendar sync
- `src/lib/leads.js` — Lead creation/merge
- `src/lib/notifications.js` — SMS + email dispatch
- `src/lib/triage/classifier.js` — Triage orchestrator
- `src/lib/triage/layer1-keywords.js` — Keyword triage
- `src/lib/triage/layer2-llm.js` — LLM triage
- `src/lib/triage/layer3-rules.js` — Owner rules triage
- `src/lib/whisper-message.js` — Transfer context builder
