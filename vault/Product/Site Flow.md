---
type: product
status: pending-rebuild
description: "User journeys through the site as built today (public site → pricing → sign-in → onboarding → dashboard) and the background call flow."
verified: 2026-11-23
tags: [voco/product]
---

# Site flow (as built)

```
New user:
  Public site (landing, about, contact) → Pricing (select plan) → /auth/signin (signup + OTP) → Onboarding wizard → Dashboard

Returning user:
  /auth/signin → Dashboard

Admin:
  /admin (inventory, tenants, test-agent), guarded by the admin_users table

Background:
  Phone call → Twilio SIP → LiveKit → Python agent answers → triage → booking → lead creation → notifications
```

After [[Plan 2 - Frontend rebrand to voice integration for any backend]] the public entry becomes: public site → "Book a demo" (contact form) or "Watch the demo". Sign-in stays for existing accounts; the onboarding wizard is no longer linked from public pages.

Systems behind each step: [[Public Site]], [[Onboarding]], [[Dashboard and CRM]], [[Voice Agent]].
