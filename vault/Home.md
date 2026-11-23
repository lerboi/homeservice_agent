---
type: hub
status: current
description: "Entry point to the Voco project vault. Read this first, then follow one link."
verified: 2026-11-23
tags: [voco/hub]
---

# Voco vault

Voco is a voice integration that connects to a business's backend. A voice agent answers a call (phone or browser), understands the request, and does the work in the systems the business already runs: books the appointment, schedules the task, creates the record. It was built first as an AI receptionist for home-service contractors; the public positioning is being changed in November 2026 (see [[Positioning]]), while the dashboard app underneath is unchanged.

## Start here

| If you need to… | Open |
|---|---|
| Know what is in flight, broken, or waiting on the owner | [[Now]] |
| Understand or change a part of the code | [[Systems]] → that system's index note |
| Do an operational task (deploy, test call, env, MCP) | [[Runbooks]] |
| Know why something is the way it is | [[Decisions]] |
| Find what was done and when (audits, fix waves, investigations) | [[Log]] |
| See active plans | [[Plans]] |
| Look up research, SDK gotchas, external pointers, documents | [[Reference]] |
| Product positioning, site flow, backlog and ideas | [[Product]] |
| How this vault is organised and how to keep it correct | [[Conventions]] |
| Old GSD planning history (`.planning/`) | [[GSD Planning History]] |

## The two repositories

| Repo | Path | What | Deploys to |
|---|---|---|---|
| `homeservice_agent` (this repo) | `C:\Users\leheh\.Projects\homeservice_agent` | Next.js 16 app: public site, auth, onboarding, dashboard, admin, API routes, Supabase migrations. Holds this vault. | Vercel |
| `livekit-agent` (GitHub `lerboi/livekit_agent`) | sibling folder `..\livekit-agent` | Python voice agent (LiveKit Agents 1.8) + FastAPI webhook service | Railway (project `miraculous-love`, service `livekit_agent`), auto-deploys from `main` |

## Stack in one paragraph

Next.js 16 App Router (JavaScript), React 19, Tailwind v4, shadcn/ui, Supabase (Auth, Postgres, RLS, Realtime, Storage), Stripe, Resend, Twilio SIP → LiveKit Cloud → Python agent running a cascaded pipeline: Deepgram nova-3 (speech to text), OpenAI gpt-4.1-mini (reasoning), ElevenLabs flash v2.5 (text to speech). Details: [[Voice Agent]].

## Rules for anyone (human or AI) working here

1. Read the system's index note before changing that system; update the matching note afterwards and set its `verified:` date.
2. Notes migrated from the old skills have `verified:` empty. Treat their details as a strong hint, and confirm against the code before relying on a specific line.
3. Both GitHub repos are public. Never write secrets, tokens, customer data or personal data into this vault.
4. The brand name is Voco. Fallback email domains use `voco.live`.
