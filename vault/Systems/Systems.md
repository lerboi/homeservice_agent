---
type: hub
status: current
description: "Index of every system in the codebase, with its status after the 2026-11 rebrand and the note to open first."
verified: 2026-11-23
tags: [voco/hub]
---

# Systems

Up: [[Home]]

Each system has a folder with an index note of the same name. Open the index, then only the notes you need.

## Product core (current focus)

| System | What it covers | Repo |
|---|---|---|
| [[Voice Agent]] | The Python agent: entrypoint, prompt, tools, post-call pipeline, triage, webhook service, test-call sandbox | `livekit-agent` |
| [[Scheduling and Calendar]] | Slot calculation, atomic booking, Google and Outlook Calendar OAuth, sync and push, crons | both |
| [[Auth and Database]] | Supabase Auth, the three client types, `proxy.js` guards, RLS, every migration and table | `homeservice_agent` |
| [[Demo Studio]] | The admin browser test console today, and the demo recording station being built | both |

## Being rebuilt

| System | What it covers | Note |
|---|---|---|
| [[Public Site]] | Landing page, pricing, about, contact, SEO pages, public chatbot, the scroll-line animation | Describes the home-service site that [[Plan 2 - Frontend rebrand to voice integration for any backend]] replaces |

## Legacy app (deployed, unchanged, not the current focus)

These describe the home-service dashboard product. Read them when working on that app.

| System | What it covers |
|---|---|
| [[Dashboard and CRM]] | Dashboard pages, customers/jobs/inquiries, settings, setup checklist, Realtime |
| [[Onboarding]] | Signup wizard, phone provisioning, trade templates, checkout |
| [[Billing]] | Stripe Checkout, webhooks, subscriptions, usage and overage |
| [[Integrations Jobber Xero]] | Jobber and Xero OAuth, webhooks, agent context injection. Flagged off: [[Decision - Jobber and Xero integrations frozen behind a flag for v1]] |
