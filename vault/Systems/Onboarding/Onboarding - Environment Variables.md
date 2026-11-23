---
type: system
system: Onboarding
status: legacy-app
description: "Environment variables Onboarding reads, and where they are set."
source: .claude/skills/onboarding-flow/SKILL.md § 11. Environment Variables
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Environment Variables

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

| Variable | Service | Purpose |
|----------|---------|---------|
| `LIVEKIT_URL` | LiveKit | LiveKit Cloud URL for test call route |
| `LIVEKIT_API_KEY` | LiveKit | API authentication for SipClient + RoomServiceClient |
| `LIVEKIT_API_SECRET` | LiveKit | API authentication |
| `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` | LiveKit | Outbound SIP trunk ID for test calls |
| `TWILIO_SIP_TRUNK_SID` | Twilio | Elastic SIP trunk for number association during provisioning |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Client-side auth + browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Client-side auth + browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side routes (sms-confirm, start, complete, sg-availability) |
| `TWILIO_ACCOUNT_SID` | Twilio | US/CA number purchase via `incomingPhoneNumbers.create()` + SMS OTP |
| `TWILIO_AUTH_TOKEN` | Twilio | US/CA number purchase + SMS OTP auth |
| `TWILIO_FROM_NUMBER` | Twilio | SMS sender |
| `STRIPE_SECRET_KEY` | Stripe | Stripe SDK initialization (server-side only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook signature verification |
| `STRIPE_PRICE_STARTER` | Stripe | Price ID for Starter plan ($99/mo) |
| `STRIPE_PRICE_GROWTH` | Stripe | Price ID for Growth plan ($249/mo) |
| `STRIPE_PRICE_SCALE` | Stripe | Price ID for Scale plan ($599/mo) |
| `NEXT_PUBLIC_APP_URL` | App | Base URL for Checkout success/cancel redirects |

---
