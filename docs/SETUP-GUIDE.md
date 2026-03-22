# HomeService AI Agent — Integration Setup Guide

This guide walks you through connecting Retell, Twilio, and your app so you can make a live test call and hear your AI receptionist answer.

**What's already built in code:**
- Retell webhook handler (signature verification, call routing, recordings, transcripts)
- Phone number provisioning via Retell API
- Test call endpoint (outbound call to your phone)
- AI system prompt with booking flow, triage, multilingual support
- Twilio SMS notifications to business owners
- Resend email notifications
- Three-layer triage classifier (keyword → LLM → rules)

**What this guide sets up:**
- Retell agent with your system prompt
- Phone number routing (Retell number or your Twilio number imported)
- Webhook connection to your running app
- All environment variables
- Your first live test call

---

## Architecture Overview

```
Caller dials phone number
        │
        ▼
┌──────────────┐     webhook      ┌──────────────────────┐
│   Retell AI  │ ──────────────►  │  Your Next.js App    │
│  (Voice +    │                  │  /api/webhooks/retell │
│   LLM)       │ ◄──────────────  │                      │
│              │   dynamic vars   │  - Tenant lookup      │
└──────────────┘                  │  - Triage pipeline    │
        │                         │  - Slot calculation   │
        │ call_ended              │  - Lead creation      │
        ▼                         │  - Recording storage  │
┌──────────────┐                  └──────────────────────┘
│  Supabase    │                           │
│  (DB + Storage)                          │
└──────────────┘                           ▼
                                  ┌──────────────────────┐
                                  │  Twilio (SMS only)   │
                                  │  Resend (Email only) │
                                  └──────────────────────┘
```

**Key point:** Retell handles voice calls and the conversational AI. Twilio is used ONLY for SMS notifications (owner alerts, caller recovery texts). These are separate systems.

---

## Prerequisites

- [x] Twilio account with 1 active US number
- [x] Retell account (https://www.retell.ai)
- [x] Groq Cloud account
- [x] Supabase project (already connected)
- [ ] ngrok or similar tunnel (for local webhook testing)
- [ ] Resend account (https://resend.com) — for email notifications (optional for initial test)

---

## Step 1: Expose Your Local App via Tunnel

Your app runs two servers that Retell needs to reach:
- **Next.js** (port 3000) — handles webhooks (`/api/webhooks/retell`)
- **Custom LLM WebSocket** (port 8081) — handles the AI conversation (`/llm-websocket/{call_id}`)

### Start both servers

Open **3 terminals**:

```bash
# Terminal 1: Next.js app
npm run dev

# Terminal 2: Custom LLM WebSocket server
npm run dev:ws

# Terminal 3: ngrok tunnels (both ports)
ngrok http --url=your-free-domain.ngrok-free.app 3000
```

For the WebSocket server, you need a second ngrok tunnel on port 8081. Open a **4th terminal**:

```bash
ngrok http 8081
```

You now have two public URLs:
- **Webhook URL:** `https://xxxx.ngrok-free.app` (port 3000 tunnel) — for Retell webhooks
- **WebSocket URL:** `https://yyyy.ngrok-free.app` (port 8081 tunnel) — for Custom LLM

**Important:** For the WebSocket URL in Retell dashboard, use `wss://` (not `https://`):
`wss://yyyy.ngrok-free.app/llm-websocket`

### Alternative: Deploy to Vercel + separate WebSocket host

Vercel handles the Next.js webhooks. The WebSocket server needs a long-running process host (Railway, Render, Fly.io, or a VPS). For initial testing, ngrok is simplest.

---

## Step 2: Create a Retell Agent with Groq + Llama 4 Scout

The Retell agent is the AI voice persona that answers calls. You'll configure it to use Groq/Llama 4 Scout as the brain via Retell's **Custom LLM** feature, which connects to a WebSocket server you host that proxies to Groq's API.

> **How this works:** Retell handles the phone call, speech-to-text, and text-to-speech. For the "thinking" part (deciding what to say), Retell connects to YOUR WebSocket server via a persistent connection. Your server receives the conversation transcript, sends it to Groq's API, and streams the response tokens back to Retell in real-time.

### 2a. Understand the Two Paths

| Path | Brain | Effort | Best for |
|------|-------|--------|----------|
| **Option 1: Retell's built-in LLM** | GPT-4.1 (Retell-hosted) | 5 minutes, dashboard only | Verifying the full pipeline works end-to-end before adding complexity |
| **Option 2: Custom LLM (Groq + Llama 4 Scout)** | Your WebSocket server → Groq API | ~1 hour, requires code + deploy | Your production goal — full control over the AI brain |

**Recommended approach:** Do Option 1 first to verify webhooks, phone numbers, and the full call pipeline work. Then switch to Option 2 once the plumbing is proven. Both options use the same webhook handler, phone number, and system prompt — you're only changing where the LLM inference runs.

---

### 2b. Option 1: Quick Start with Retell's Built-in LLM

Use this to verify everything works before building the Custom LLM server.

#### Step 1: Create the agent

1. Go to **https://dashboard.retell.ai**
2. Click the **Agents** tab in the left sidebar
3. Click **Create Agent** (top-right button)
4. Select **Phone** as the agent type (not Chat)
5. Choose **Single Prompt** as the framework (simplest — one system prompt drives the conversation)
6. You'll land on the agent configuration page

#### Step 2: Configure basic settings

On the agent config page, set these in order:

**LLM Model** (top of page):
- Select **GPT-4.1** from the model dropdown (recommended by Retell for best balance of quality/latency/cost)
- Leave temperature at default (0.0 for deterministic responses)

**Agent Name** (click the name at the top to edit):
- Change to: `HomeService Receptionist`

**Voice** (Voice section):
- Click the voice selector and listen to samples
- Pick a warm, professional voice — Retell offers voices from ElevenLabs and others
- Set **Voice Speed** to `0.95` (slightly slower = more professional)

**Language:**
- Select **Multilingual** if available, otherwise **English**

#### Step 3: Set the system prompt

In the **Prompt** section, paste the full system prompt (see section 2d below).

#### Step 4: Configure conversation settings

Scroll down to the advanced settings:

- **Responsiveness:** `0.75` (slightly slower, more thoughtful responses)
- **Interruption Sensitivity:** `0.7` (allows callers to interrupt naturally)
- **Ambient Sound:** `off`
- **Max Call Duration:** Set to 10 minutes / 600 seconds
- **Backchanneling:** Enable (the agent says "mhm", "I see" while listening)
- **Who speaks first:** Select **Agent** — the receptionist should greet the caller
- **Agent's first message:** Leave empty (the system prompt handles the greeting via dynamic variables)
- **End Call on Silence:** `30 seconds`
- **Voicemail Detection:** Enable if available

#### Step 5: Add custom functions

See section 2e below for the two functions to add (transfer_call and book_appointment).

#### Step 6: Save and test in browser

- Click **Save** (top-right)
- Click the **Test** button in the dashboard to have a test conversation via your browser microphone
- Verify the agent greets you and responds naturally

**Skip to section 2f** (webhook setup) after this works.

---

### 2c. Option 2: Custom LLM with Groq + Llama 4 Scout (Your Goal)

This replaces Retell's built-in LLM with your own WebSocket server that proxies to Groq. You get full control over the AI brain, lower cost, and faster inference.

#### How Custom LLM works (architecture)

```
┌─────────┐  audio   ┌───────────┐  WebSocket  ┌─────────────────┐  REST API  ┌──────┐
│  Caller  │ ◄─────► │  Retell   │ ◄─────────► │ Your WS Server  │ ─────────► │ Groq │
│ (phone)  │         │ (STT/TTS) │             │ (Next.js route)  │ ◄───stream─ │ API  │
└─────────┘          └───────────┘              └─────────────────┘            └──────┘
```

1. Caller speaks → Retell converts speech to text
2. Retell sends transcript to YOUR WebSocket server
3. Your server sends transcript to Groq's chat completions API (streaming)
4. Groq streams tokens back → your server forwards each token to Retell
5. Retell converts text to speech → caller hears the response

#### Step 1: Build the Custom LLM WebSocket server

Create a new API route in your Next.js app. This is the WebSocket server that Retell connects to.

> **Note:** This WebSocket server will be built as a code task in Phase 7. The code below shows the architecture so you understand what's needed. I'll implement the production version when we plan Phase 7.

The server needs to handle these Retell message types:

```
Retell → Your Server:
{
  "interaction_type": "call_details",     // Call metadata (first message)
  "interaction_type": "update_only",      // Transcript update, no response needed
  "interaction_type": "response_required", // User finished talking, agent must respond
  "interaction_type": "reminder_required", // Silence timeout, agent should re-engage
  "interaction_type": "ping_pong",        // Keepalive heartbeat
  "response_id": 123,                    // Which response this relates to
  "transcript": [                        // Full conversation so far
    {"role": "agent", "content": "Hello, how can I help?"},
    {"role": "user", "content": "I have a leaking pipe"}
  ]
}

Your Server → Retell:
{
  "response_type": "response",
  "response_id": 123,                  // Match the request
  "content": "I'm sorry to hear",      // Partial text (streamed token by token)
  "content_complete": false,            // false = more coming, true = done
  "end_call": false,                    // true = hang up after speaking
  "transfer_number": "+1234567890"      // Optional: transfer call to this number
}
```

Your server's job for each `response_required` message:
1. Take the `transcript` array
2. Prepend your system prompt as the first message
3. Call `https://api.groq.com/openai/v1/chat/completions` with `stream: true`
4. For each streamed token, send a `response` message with `content_complete: false`
5. On the final token, send `content_complete: true`

#### Step 2: Create the agent in Retell dashboard (Custom LLM mode)

1. Go to **https://dashboard.retell.ai**
2. Click the **Agents** tab in the left sidebar
3. Click **Create Agent** (top-right)
4. Select **Phone** as the agent type
5. **IMPORTANT:** Select **Custom LLM** as the framework (NOT Single Prompt or Conversation Flow)
6. You'll see a different config page — no prompt field, but a **WebSocket URL** field instead

#### Step 3: Configure the Custom LLM agent

**Agent Name** (click to edit):
- `HomeService Receptionist`

**LLM WebSocket URL** (this is the key field):
- For local testing: `wss://xxxx.ngrok-free.app/api/retell-llm-ws`
- For production: `wss://yourdomain.com/api/retell-llm-ws`
- This must be a `wss://` (secure WebSocket) URL
- Retell will append `/{call_id}` automatically when connecting, so your endpoint receives the call ID as a path parameter

**Voice:**
- Same as Option 1 — pick a warm, professional voice
- Set **Voice Speed** to `0.95`

**Advanced settings:**
- **Responsiveness:** `0.75`
- **Interruption Sensitivity:** `0.7`
- **Ambient Sound:** `off`
- **Max Call Duration:** 600 seconds (10 minutes)
- **Backchanneling:** Enable
- **Who speaks first:** Select **Agent**
- **End Call on Silence:** `30 seconds`

#### Step 4: Custom functions with Custom LLM

With Custom LLM, functions work differently than with the built-in LLM:

- You do NOT add functions in the Retell dashboard
- Instead, your WebSocket server defines tools in the system prompt sent to Groq
- When Groq returns a tool call, your server executes it (calls your own API) and sends the result back
- Your server then continues the conversation with the tool result

This means your WebSocket server handles the full function-calling loop:
1. Groq says "I want to call `book_appointment`" via tool_call
2. Your server calls `POST /api/webhooks/retell` (or directly calls the booking logic)
3. Your server sends the result back to Groq as a tool message
4. Groq responds with what to say to the caller
5. Your server streams that response to Retell

**Alternatively**, Retell also supports a tool call protocol via WebSocket messages:
- Your server sends `{"response_type": "tool_call_invocation", "tool_call_id": "...", "name": "book_appointment", "arguments": "..."}`
- Retell routes it to your webhook as a `call_function_invoked` event
- Your webhook responds with the result
- Retell forwards the result back to your WebSocket server

#### Step 5: Configure first message

Since you're using Custom LLM, the agent's first message comes from YOUR server, not Retell's dashboard.

When Retell opens the WebSocket connection, your server should immediately send:

```json
{
  "response_type": "config",
  "config": {
    "auto_reconnect": true,
    "call_details": true
  }
}
```

Then send the greeting:

```json
{
  "response_type": "response",
  "response_id": 0,
  "content": "Hello, thank you for calling. This call may be recorded for quality purposes. How can I help you today?",
  "content_complete": true,
  "end_call": false
}
```

Your webhook's `call_inbound` handler will inject the business name and other dynamic variables. Your WebSocket server should read these from the `call_details` message that Retell sends right after connection.

#### Step 6: Deploy and set the URL

For local testing (see Step 1 for full details):
1. Start Next.js: `npm run dev`
2. Start WebSocket server: `npm run dev:ws` (port 8081)
3. Start ngrok tunnel for port 8081: `ngrok http 8081`
4. In Retell dashboard, set the LLM WebSocket URL to: `wss://yyyy.ngrok-free.app/llm-websocket`
   (where `yyyy` is the ngrok subdomain for port 8081)

For production:
- The WebSocket server needs a long-running process host (Railway, Render, Fly.io, or a VPS)
- Vercel does NOT support persistent WebSocket connections on serverless functions
- Set the URL to: `wss://your-ws-host.com/llm-websocket`

#### Step 7: Save and test

- Click **Save** in the Retell dashboard
- Use the **Test** button to verify the connection works
- Check your server logs — you should see the WebSocket connection open and messages flowing

> **The Custom LLM WebSocket server is already built** at `src/server/retell-llm-ws.js`. It runs as a standalone process alongside Next.js. See Step 1 for how to expose both servers via ngrok.

---

### 2d. System Prompt

If using **Option 1 (built-in LLM):** paste this into the Prompt field in the Retell dashboard.
If using **Option 2 (Custom LLM):** your WebSocket server prepends this as the system message when calling Groq.

The dynamic variables in `{{curly braces}}` are injected by your inbound webhook at call time:

```
You are a professional AI receptionist for {{business_name}}. You are warm, friendly, calm, and speak at a moderate pace.

PERSONALITY:
- Your communication style is {{tone_preset}}.

RECORDING NOTICE:
- State at the start of every call: "This call may be recorded for quality purposes."

Greet the caller: "Hello, thank you for calling {{business_name}}. This call may be recorded for quality purposes. How can I help you today?"

LANGUAGE INSTRUCTIONS:
- Detect the language of the caller's first utterance.
- Respond exclusively in the language the caller used in their most recent turn.
- If the caller switches language mid-conversation, immediately switch your responses to match.
- If the caller speaks a language other than English or Spanish, apologize, gather their name and phone number, and end gracefully.

INFORMATION GATHERING:
- Ask for the caller's name
- Ask for the service address
- Ask what issue they need help with
- Capture all details before attempting any action

CURRENT CAPABILITIES:
- You can capture caller information (name, phone, address, issue).
- You can book appointments using the available_slots data.

BOOKING FLOW:
When a caller needs service:
1. Determine the service type and urgency
2. Offer 2-3 available slots: "I have a few openings: {{available_slots}}. Which works best?"
3. Collect service address
4. MANDATORY: Read back the address: "Just to confirm, you're at [address], correct?"
5. Only after they confirm, invoke book_appointment
6. Confirm: "Your appointment is confirmed for [time]. You'll receive a confirmation."

CALL TRANSFER:
- If the caller wants a human: capture their info FIRST, then invoke transfer_call
- If transfer fails: "I'll make sure someone calls you back within the hour."

TRIAGE BEHAVIOR:
- Emergency (flooding, gas leak): speak faster, be urgent, prioritize earliest slot
- Routine (quotes, scheduling): relaxed approach, don't pressure
```

### 2e. Add Custom Functions to the Agent

**Only for Option 1 (built-in LLM).** For Option 2 (Custom LLM), functions are handled by your WebSocket server — skip this section.

In the Retell agent dashboard, scroll to the **Functions** section and add these:

**Function 1: transfer_call**

1. Click **Add Function**
2. Set **Name** to: `transfer_call`
3. Set **Description** to: `Transfer the current call to the business owner's phone number. Use this when the caller requests to speak with a human or when you cannot handle their request. Always capture caller information (name, phone, issue) BEFORE invoking this function.`
4. **Parameters:** Leave empty (no parameters needed — the webhook resolves the owner's phone from the tenant record)
5. Click **Save**

**Function 2: book_appointment**

1. Click **Add Function**
2. Set **Name** to: `book_appointment`
3. Set **Description** to: `Book a confirmed appointment slot for the caller. Only invoke AFTER: (1) collecting caller name, phone, and service address, (2) reading back the address and receiving verbal confirmation, and (3) the caller has selected a slot from the offered options.`
4. **Parameters** — add each one by clicking **Add Parameter**:

   | Name | Type | Required | Description |
   |------|------|----------|-------------|
   | `slot_start` | string | Yes | ISO 8601 datetime of the appointment start (e.g., "2026-03-21T10:00:00") |
   | `slot_end` | string | Yes | ISO 8601 datetime of the appointment end |
   | `service_address` | string | Yes | Service address as verbally confirmed by the caller |
   | `caller_name` | string | Yes | Caller full name |
   | `urgency` | string | Yes | Urgency level: emergency, routine, or high_ticket |

5. Click **Save**

### 2f. Configure Webhooks

You need TWO webhook configurations: one for inbound call routing (dynamic variables), one for post-call events.

#### Inbound Call Webhook (per-agent)

This webhook fires BEFORE the call connects. Your app uses it to look up the tenant and inject dynamic variables (business name, available slots, etc.).

1. In the agent config page, find the **Webhook** section
2. Set **Inbound Webhook URL** to:
   ```
   https://xxxx.ngrok-free.app/api/webhooks/retell
   ```
   (Replace with your ngrok or production URL)

This is the same endpoint that handles all Retell events — your code already routes based on the `event` field.

#### Post-Call Webhooks (account-level)

These fire after calls end. Your app uses them to store recordings, transcripts, create leads, and send notifications.

1. Click the **gear icon** (Settings) in the left sidebar
2. Go to the **Webhooks** tab
3. Set the **Webhook URL** to the same endpoint:
   ```
   https://xxxx.ngrok-free.app/api/webhooks/retell
   ```
4. The events sent to this URL include:
   - `call_ended` — call metadata, triggers lead creation + notifications
   - `call_analyzed` — recording URL + transcript, triggers storage

**Important:** If you set a webhook URL at the agent level, it overrides the account-level webhook for that agent. Your code handles all event types on the same endpoint, so using the same URL for both is fine.

### 2g. Note Your Agent ID

1. On the agent config page, look at the URL in your browser — it contains the agent ID:
   `https://dashboard.retell.ai/agents/agent_xxxxxxxxxxxx`
2. Or find it in the agent settings panel
3. Copy this ID — you'll use it if you need to reference the agent programmatically

### 2h. Test in Dashboard

Before connecting a phone number:

1. Click the **Test** button (phone icon) in the top-right of the agent page
2. Allow microphone access in your browser
3. Speak: "Hi, I have a leaking pipe in my kitchen"
4. Verify the agent:
   - Greets you (may use default business name since no webhook fires for browser tests)
   - Asks for your name
   - Asks for your address
   - Attempts to offer appointment slots

If the conversation flows naturally, your agent is ready for a real phone call (Step 3).

---

## Step 3: Phone Number Setup

You have two options:

### Option A: Use a Retell Phone Number (simplest)

1. In Retell dashboard → **Phone Numbers** → **Buy Number**
2. Select a US number
3. Assign it to your `HomeService Receptionist` agent
4. Done — calls to this number go through Retell → your webhook

### Option B: Import Your Twilio Number into Retell

If you want to use your existing Twilio number for inbound voice calls:

1. In Retell dashboard → **Phone Numbers** → **Import Number**
2. Select **Twilio** as provider
3. Enter:
   - **Twilio Account SID** (from https://console.twilio.com)
   - **Twilio Auth Token**
   - **Phone Number** to import (your active US number)
4. Assign the imported number to your `HomeService Receptionist` agent
5. Retell will configure Twilio to forward calls to Retell's servers automatically

**Important:** Once imported, inbound calls to this number route through Retell (not Twilio). Twilio still handles SMS via your code. This is fine — voice and SMS use different Twilio configurations.

### Which to pick?

- **Starting out / testing:** Option A (Retell number). Keeps your Twilio number free for SMS.
- **Production:** Option B (import Twilio number). One number for everything — callers call the same number they receive SMS from.

---

## Step 4: Environment Variables

Add these to your `.env.local` file:

```bash
# ─── Already configured ──────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RETELL_API_KEY=your-retell-api-key

# ─── ADD THESE ────────────────────────────────────────

# Twilio (for SMS notifications — NOT voice calls)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1XXXXXXXXXX  # Your Twilio phone number (E.164 format)

# Groq (for triage Layer 2 — LLM urgency scoring via Llama 4 Scout)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Resend (for email notifications — optional for initial test)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=alerts@yourdomain.com

# App URL (used in SMS/email notification links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Where to find each value:

| Variable | Where to get it |
|----------|----------------|
| `TWILIO_ACCOUNT_SID` | https://console.twilio.com → Dashboard → Account SID |
| `TWILIO_AUTH_TOKEN` | https://console.twilio.com → Dashboard → Auth Token (click to reveal) |
| `TWILIO_FROM_NUMBER` | https://console.twilio.com → Phone Numbers → Active Numbers → copy in E.164 format (+1...) |
| `GROQ_API_KEY` | https://console.groq.com/keys → Create new key |
| `RESEND_API_KEY` | https://resend.com/api-keys → Create key |
| `RESEND_FROM_EMAIL` | Must be a verified domain in Resend, or use `onboarding@resend.dev` for testing |
| `RETELL_API_KEY` | https://dashboard.retell.ai → Settings → API Keys |

---

## Step 5: Groq Triage — Already Configured

The triage pipeline (Layer 2 in `src/lib/triage/layer2-llm.js`) has already been switched from OpenAI to **Groq + Llama 4 Scout**. No code changes needed.

Just make sure `GROQ_API_KEY` is set in your `.env.local` (see Step 4).

---

## Step 6: Database Verification

Your Supabase database should already have these tables from prior migrations. Verify they exist:

1. Go to https://supabase.com/dashboard → your project → Table Editor
2. Confirm these tables exist:
   - `tenants` — with columns: `retell_phone_number`, `owner_phone`, `business_name`, `tone_preset`, `onboarding_complete`, `test_call_completed`
   - `calls` — with columns: `retell_call_id`, `recording_url`, `transcript_text`, `urgency_classification`
   - `leads` — call-derived lead records
   - `appointments` — booked slots
   - `services` — per-tenant service list

If any are missing, run migrations:
```bash
npx supabase db push
```

---

## Step 7: Create Your Test Tenant

Before testing, you need a tenant record in the database:

1. Go to Supabase → SQL Editor
2. Run:

```sql
-- Replace with your actual values
INSERT INTO tenants (
  id,
  business_name,
  owner_phone,
  owner_email,
  retell_phone_number,
  tone_preset,
  default_locale,
  onboarding_complete,
  trade_type
) VALUES (
  gen_random_uuid(),
  'My Plumbing Co',
  '+6587528516',        -- YOUR personal phone number (to receive test calls + SMS)
  'homeserviceaisg@email.com',       -- YOUR email (to receive lead notifications)
  '+13203890626',        -- The Retell phone number assigned to your agent (from Step 3)
  'friendly',
  'en',
  true,
  'plumber'
)
RETURNING id;
```

**Save the returned `id`** — this is your tenant ID.

**Note:** The `retell_phone_number` must match exactly what Retell assigned (or what you imported). This is how the webhook looks up which tenant a call belongs to.

---

## Step 8: First Test Call

### 8a. Start your app with the tunnel

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start ngrok tunnel
ngrok http 3000
```

Make sure your Retell agent's webhook URL matches your ngrok URL.

### 8b. Call the number

1. From a phone that is NOT your owner_phone (use a friend's phone or a second number), dial the Retell phone number from Step 3
2. You should hear the AI receptionist greet you with your business name
3. Try saying: "Hi, I have a leaking faucet and need a plumber"
4. The AI should:
   - Ask for your name
   - Ask for your address
   - Offer available time slots (or say none are available if no working hours are configured)

### 8c. What to watch in your terminal

Your Next.js dev server logs will show:
- `POST /api/webhooks/retell` — each webhook event
- `[call-processor] ...` — call processing logs
- `[notifications] ...` — SMS/email send attempts

### 8d. Verify in Supabase

After the call ends, check:
- `calls` table — new row with `retell_call_id`, `transcript_text`, recording URL
- `leads` table — new lead with caller info, urgency classification

---

## Step 9: Test Call from Dashboard (API)

Your app has a test call endpoint that calls YOUR phone (the owner) so you can hear what your AI sounds like:

```bash
# Replace with your actual values
curl -X POST http://localhost:3000/api/onboarding/test-call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"
```

This triggers an outbound call from your Retell number TO your owner_phone. You'll receive a call and hear the AI receptionist.

**Note:** The dashboard UI for this button will be built in Phase 7 (Onboarding Wizard). For now, you can trigger it via API.

---

## Troubleshooting

### "Unauthorized" on webhook
- Check that `RETELL_API_KEY` in `.env.local` matches the key in Retell dashboard
- Retell uses this key for webhook signature verification

### No call comes through
- Verify the phone number in Retell dashboard is assigned to your agent
- Verify the webhook URL is correct and your tunnel is running
- Check Retell dashboard → Call Logs for errors

### Webhook hits but no tenant found
- The `retell_phone_number` in your tenant row must exactly match the number Retell sends in the `to_number` field
- Check format: should be E.164 (e.g., `+12125551234`)

### SMS not sending
- Verify `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` are set
- Twilio trial accounts can only send SMS to verified numbers — verify your test phone in Twilio console

### "Test call failed"
- The test call endpoint requires both `retell_phone_number` AND `owner_phone` on the tenant
- Ensure both are set and in E.164 format

### Recording not saved
- Check that your Supabase storage bucket exists: `call-recordings`
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (needed for storage uploads)

---

## Quick Reference: What Each Service Does

| Service | Role | Used For |
|---------|------|----------|
| **Retell** | Voice AI platform | Answers calls, runs AI conversation, records calls, sends webhooks |
| **Twilio** | SMS gateway | Owner alert texts, caller recovery texts. Phone number can be imported into Retell for calls. |
| **Groq** | LLM inference | Triage urgency scoring (Layer 2). Future: voice agent brain via Custom LLM. |
| **Supabase** | Database + Storage | Tenant data, calls, leads, appointments, recording files |
| **Resend** | Email delivery | Owner lead alert emails |

---

## What's Next After Your Test Call Works

Once you've made a successful test call and verified the pipeline:

1. **Swap triage LLM to Groq** — code change to `layer2-llm.js` (I can do this)
2. **Phase 7: Onboarding Wizard** — builds the dashboard UI for test calls, setup checklist, and the full signup flow
3. **Custom LLM WebSocket** — use Groq/Llama 4 Scout as the voice conversation brain (replaces Retell's built-in LLM)
4. **Configure working hours** — set up your tenant's `working_hours` JSON so the AI can offer real appointment slots
