---
type: log
date: 2026-06-13
status: record
description: "2026-06-13 onboarding audit fix wave implemented (uncommitted); full brief + status in [[2026-06-13 Onboarding journey audit - findings and change plan (full report)]]; SG restock, C4 activation guide, H5 routing flag still open"
source: "Claude memory note project_onboarding_audit_fix_wave.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-06-13 Onboarding audit fix wave
The 2026-06-12 onboarding-journey audit (full brief: [[2026-06-13 Onboarding journey audit - findings and change plan (full report)]]) had its Critical+High fix wave implemented on 2026-06-13 — **uncommitted in the working tree**. Verified via lint + `next build` (exit 0) + related jest suites.

Key implemented facts a future session needs:
- Checkout webhook now seeds trade-default `working_hours` + SG timezone backstop, provisions idempotently (SG inventory reuse; US/CA Twilio `friendlyName: voco-tenant-{id}` reuse), sends idempotent `WelcomeEmail` (`billing_notifications` type `welcome`) and deduped failure email (type `provisioning_failed`).
- `sms-confirm` sets `tenant_timezone` (SG pinned Asia/Singapore; US/CA from browser IANA), validates E.164, 503-on-countError vs 409-sold-out, 400 when no tenant row.
- New `GET /api/onboarding/state` rehydrates wizard pages when sessionStorage is empty.
- `proxy.js` rescues paid-but-unflagged tenants hitting /dashboard (service-role `is_current` subscription check → repair `onboarding_complete`).
- All "70+ languages"/Mandarin/Singlish/Hokkien marketing claims cut to EN+ES (landing components, comparisons.js, glossary.js, `src/lib/public-chatbot-knowledge/*`).
- Hero CTA now routes to /pricing (pricing-first funnel).

**Why:** A new tenant previously could not receive a single booking (NULL working_hours → zero slots) and SG tenants ran on America/Chicago time; paid users were stranded by 60s verify timeouts.

**How to apply:** Don't re-fix these; check `git log`/diff for the commit. STILL OPEN: restock SG `phone_inventory` (live count was 0 — SG signups hard-blocked), C4 call-forwarding activation guide (biggest remaining value gap), resolve the 1 existing `provisioning_failed` tenant, H5 `routing_pending` column (migration 072) for silent SIP-trunk association failures, M/L items, `scripts/generate_marketing_pdf.py` still claims "no credit card required". Pre-existing test failures (stale `@/lib/retell` mocks; incomplete supabase mocks for /api/services + cron/trial-reminders) are NOT from this wave. Related: [[2026-06-12 Eight-pass full audit]], [[2026-06-09 Cascade pipeline migration (Deepgram + gpt-4.1-mini + ElevenLabs)]].
