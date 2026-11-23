---
name: onboarding-flow
description: "Complete architectural reference for the onboarding wizard — 4-step signup flow (profile, services, contact details, checkout), all onboarding API routes, country-aware phone number provisioning (SG inventory via RPC, US/CA via Twilio API + SIP trunk association), trade templates, Stripe Checkout Session, session persistence, and middleware auth guards. Test call functionality (LiveKit SIP) lives post-payment in dashboard settings, not in the wizard. Use this skill whenever making changes to the onboarding wizard, signup flow, phone provisioning, trade templates, billing checkout, or wizard session management. Also use when the user asks about how onboarding works, wants to modify wizard steps, or needs to debug provisioning or OTP issues."
---

# onboarding-flow (moved to the vault)

The architecture reference that used to be in this file now lives in the Obsidian vault as small linked notes. This system is part of the legacy home-service app: deployed and unchanged, not the current product focus.

1. Read the index: `vault/Systems/Onboarding/Onboarding.md`. It lists every note with a one-line description.
2. Open only the notes the task needs (same folder).
3. Notes with an empty `verified:` field were migrated verbatim on 2026-11-23 and not re-checked: confirm specifics against the code.
4. After changing code in this system, update the matching vault note and set its `verified:` date. Do not add documentation back into this file.
