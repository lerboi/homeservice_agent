# Twilio + LiveKit Call Failure Debug Checklist

When calling the Twilio number and the call fails immediately (no ring, no audio):

## 1. Check Twilio Phone Number Voice Configuration
- **Twilio Console** → Phone Numbers → Active Numbers → click your number
- Under "Voice Configuration", verify it's set to use the **SIP Trunk** (not a TwiML app, webhook, or Retell)
- If it still points to Retell or a TwiML app, that's the problem

## 2. Check Twilio Elastic SIP Trunk Origination URI
- **Twilio Console** → Elastic SIP Trunking → your trunk (e.g., `voco-livekit`)
- Under **Origination** tab, verify the URI is:
  ```
  sip:<your-livekit-project>.sip.livekit.cloud;transport=tcp
  ```
- Priority: 10, Weight: 10
- If this is wrong or missing, Twilio has nowhere to send the call

## 3. Verify Phone Number is Associated with SIP Trunk
- **Twilio Console** → Elastic SIP Trunking → your trunk → **Numbers** tab
- Your Twilio number must be listed here
- Numbers provisioned before the migration (when routed to Retell) may not be on the trunk yet
- If missing: click "Add a Number" and associate it

## 4. Check LiveKit SIP Inbound Trunk
- **LiveKit Dashboard** (cloud.livekit.io) → SIP → Inbound Trunks
- An inbound trunk must exist with your Twilio number(s) in the `numbers` array
- If the number isn't listed, LiveKit won't accept the SIP INVITE from Twilio
- Create via: `lk sip inbound create` with your trunk config JSON

## 5. Check LiveKit SIP Dispatch Rule
- **LiveKit Dashboard** → SIP → Dispatch Rules
- A dispatch rule must exist (e.g., `dispatchRuleIndividual` with `roomPrefix: "call-"`)
- Without it, the call arrives at LiveKit but no room is created and no agent is dispatched
- Create via: `lk sip dispatch create` with your dispatch rule JSON

## 6. Check Agent is Running on Railway
- **Railway Dashboard** → your livekit_agent service → check deployment status
- Look at **logs** for:
  - Successful startup messages
  - Any crash/error on boot
  - Whether it's registering with LiveKit as an available worker
- If the agent isn't running, LiveKit creates a room but no agent joins → timeout → call drops

## 7. Check if Number is Still Imported in Retell
- If the number was previously imported into Retell, it may still be claimed there
- Retell would intercept the call before Twilio SIP trunking kicks in
- **Retell Dashboard** → Phone Numbers → check if your number is still listed
- If so: unimport/release it from Retell first

## 8. Check Twilio Call Logs (Fastest Diagnostic)
- **Twilio Console** → Monitor → Logs → Calls
- Find the failed call and look at:
  - **SIP response code**: tells you exactly where it failed
    - `Location not found` / `404` = bad origination URI or number not on trunk
    - `503 Service Unavailable` = LiveKit rejected the SIP INVITE (trunk/dispatch issue)
    - `480 Temporarily Unavailable` = LiveKit accepted but no agent answered
    - `487 Request Terminated` = call was cancelled before connection
  - **Error code**: Twilio-specific error with documentation link
  - **Call duration**: 0s confirms immediate failure vs timeout

## 9. Verify Environment Variables
On Railway (livekit_agent service), ensure these are set:
- `LIVEKIT_URL` — must match your LiveKit Cloud project URL
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — must match LiveKit Cloud credentials
- `GOOGLE_API_KEY` — for Gemini Live
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — for direct DB access

On Vercel (homeservice_agent), ensure these are set:
- `TWILIO_SIP_TRUNK_SID` — must match the trunk you configured
- `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — for test calls
- `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` — for test calls

## Debugging Order
Start with **#8 (Twilio Call Logs)** — the SIP error code will immediately narrow down which of the above is the issue.
