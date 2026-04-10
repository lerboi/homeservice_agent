# Voco Call Routing System

## What Changed (Phase 39-40)

Previously, every inbound call went straight to the AI receptionist via SIP trunking. Now there's a **routing layer** in front that can send calls to the business owner first, with the AI as a fallback.

**Nothing about the AI itself changed.** The prompt, tools, voice, personality, booking logic, triage, post-call pipeline, lead creation, notifications — all identical. The routing layer only decides *who picks up first*.

---

## How Calls Work Now

```
Customer dials Twilio number
        |
        v
  Twilio sends POST to Railway webhook
  (voice_url = /twilio/incoming-call)
        |
        v
  +-----------------------+
  | ROUTING DECISION      |
  |                       |
  | 1. Look up tenant     |
  | 2. Check subscription |
  | 3. Evaluate schedule  |
  | 4. Check soft cap     |
  +-----------------------+
        |
   +---------+---------+
   |                   |
   v                   v
 AI MODE          OWNER-PICKUP MODE
   |                   |
   v                   v
 SIP Trunk -->    Parallel ring all
 LiveKit -->      owner's pickup numbers
 Gemini AI        (up to 5 simultaneously)
 (same as              |
  before)         +---------+---------+
                  |                   |
                  v                   v
              Owner answers      No answer?
              (call done -       Twilio fires
               no AI, no        voice_fallback_url
               transcript,           |
               no lead)              v
                              /twilio/dial-fallback
                                     |
                                     v
                               AI MODE (same
                               as direct AI -
                               identical greeting)
```

## The Three Webhook URLs

Every Twilio number now has three URLs configured:

### 1. voice_url -> /twilio/incoming-call
The main routing endpoint. Runs the decision chain:
- **Tenant lookup** — which business owns this number?
- **Subscription check** — is their subscription active? (fail-open: blocked tenants still get AI)
- **Schedule evaluation** — is this during owner-pickup hours or AI hours? (configurable per tenant)
- **Soft cap check** — is the tenant under their outbound dial cap? (cap breach downgrades to AI)

Returns TwiML telling Twilio what to do:
- **AI mode**: `<Dial><Sip>sip:...@sip.livekit.cloud</Sip></Dial>` (same as the old SIP trunk path)
- **Owner-pickup mode**: `<Dial timeout="15" callerId="+1caller"><Number>+1owner1</Number><Number>+1owner2</Number></Dial>`

### 2. voice_fallback_url -> /twilio/dial-fallback
Fires when the owner doesn't answer the parallel ring. Returns the same AI SIP TwiML — caller gets transferred to the AI seamlessly. Same greeting, same experience. The caller doesn't know they were routed to the owner first.

### 3. sms_url -> /twilio/incoming-sms
When a customer texts the Twilio number:
- Forwards the text to owner's pickup numbers that have SMS forwarding enabled
- Format: `[Voco] From +15551234567: <message>`
- MMS attachments aren't forwarded (just a note: "[Media attached - view in Twilio console]")
- Logged to the `sms_messages` database table

## Additional Webhook: /twilio/dial-status
Not a URL on the number itself — it's the `action` URL inside the `<Dial>` TwiML. Fires after the owner-pickup dial completes. Writes to the database:
- `outbound_dial_duration_sec` — how long the owner talked (for cost tracking)
- `routing_mode` — updated to `fallback_to_ai` if owner didn't answer

---

## What Happens in Each Scenario

| Scenario | What happens |
|----------|-------------|
| Normal hours, schedule = AI | Straight to AI (same as before) |
| Owner-pickup hours, owner answers | Owner talks to customer. No AI, no transcript, no lead created. Minimal `calls` row for tracking. |
| Owner-pickup hours, owner doesn't answer | Parallel ring times out -> fallback -> AI picks up (same greeting as direct AI) |
| Owner-pickup hours, cap breached | Downgraded to AI mode automatically |
| Blocked subscription (canceled/paused) | Routed to AI (fail-open). Agent-side gate handles the rest. |
| Unknown number (no tenant match) | Routed to AI (fail-open) |
| No pickup numbers configured | Routed to AI |
| Customer sends SMS | Forwarded to owner's phones with SMS forwarding enabled |

---

## SIP Trunk = Rollback Safety Net

The old SIP trunk associations are **still on every number**. Twilio prioritizes `voice_url` over SIP trunk when both are set. If anything goes wrong with the webhook:

1. Clear `voice_url` on the Twilio number
2. SIP trunk routing resumes immediately
3. Every call goes straight to AI again (pre-Phase 40 behavior)

No code changes needed — just a Twilio console toggle.

---

## Infrastructure Requirements

| Service | What's needed | Purpose |
|---------|--------------|---------|
| **Railway** | livekit-agent running with FastAPI webhook server | Hosts the routing decision endpoints |
| **Vercel** | `RAILWAY_WEBHOOK_URL` env var | Provisioning code sets URLs on new Twilio numbers |
| **Twilio** | Numbers configured with voice_url/voice_fallback_url/sms_url | Routes calls through Railway webhook |
| **Supabase** | `sms_messages` table (migration 045), `call_sid` column on `calls` | SMS audit log + owner-pickup call tracking |

---

## Database Changes (Migration 045)

**New table: `sms_messages`**
- Logs all inbound customer texts and forwarded copies
- Columns: id, tenant_id, from_number, to_number, body, direction (inbound/forwarded), created_at
- RLS: tenants can only read their own messages

**New column on `calls`: `call_sid`**
- Links the initial owner-pickup call record to the Twilio dial-status callback
- Used by `/twilio/dial-status` to find and update the right row

---

## What DIDN'T Change

- AI agent prompt and personality
- AI agent tools (booking, triage, lead creation, etc.)
- Post-call pipeline (transcript, triage, notifications)
- LiveKit/Gemini voice infrastructure
- Subscription billing and usage tracking
- Dashboard and CRM
- Everything the end customer experiences when talking to the AI
