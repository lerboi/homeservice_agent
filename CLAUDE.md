# Voco — Project Instructions

## What this is

Voco is a voice integration that connects to a business's backend. A voice agent answers a call (phone or browser), understands the request, and does the work in the systems the business already runs: books the appointment, schedules the task, creates the record. It was first built as an AI receptionist for home-service contractors; the public positioning is being changed (November 2026) while the dashboard app behind sign-in is unchanged.

**Stack**: Next.js 16 (App Router, JavaScript), React 19, Tailwind v4, shadcn/ui, next-intl, Supabase (Auth, Postgres, RLS, Realtime, Storage), Stripe, Resend, Twilio SIP → LiveKit → Python voice agent on Railway (Deepgram nova-3 → OpenAI gpt-4.1-mini → ElevenLabs flash v2.5).

**Two repos**: this one (Next app, deployed to Vercel) and the sibling `../livekit-agent` (Python voice agent, deployed to Railway).

## Project knowledge lives in the Obsidian vault: `vault/`

Do not look for architecture docs in this file or in `.claude/skills/`. Everything is in `vault/`, as small linked notes.

| Need | Read |
|---|---|
| Orientation | `vault/Home.md` |
| What is in flight, broken, or waiting on the owner | `vault/Now.md` |
| How a system works | `vault/Systems/Systems.md` → `vault/Systems/<System>/<System>.md` (index with one line per note) → only the notes you need |
| Operational steps (deploy, test call, env, MCP) | `vault/Runbooks/Runbooks.md` |
| Why something is the way it is | `vault/Decisions/Decisions.md` |
| What was done and when | `vault/Log/Log.md` |
| Active plans | `vault/Plans/Plans.md` |
| Research, SDK gotchas, documents | `vault/Reference/Reference.md` |
| How the vault is organised and maintained | `vault/_meta/Conventions.md` |
| Working agreements with the owner (Claude memory) | `vault/Memory/MEMORY.md` |

Systems: Voice Agent, Scheduling and Calendar, Auth and Database (all tables and migrations), Demo Studio, Public Site, and the legacy app systems Dashboard and CRM, Onboarding, Billing, Integrations Jobber Xero.

## Supabase MCP

The `supabase-voco` MCP server (`.mcp.json`, gitignored) gives tools prefixed `mcp__supabase-voco__` against project `exbzhmparzjlpkryeiso`: `execute_sql`, `list_tables`, `apply_migration`, `get_logs`. Use them to inspect live data and verify the schema instead of relying on migration files or notes alone.

## Rules

- **Keep the vault in sync.** Before changing a system, read its index note. After changing it, update the matching note and set its `verified:` date. Record decisions in `vault/Decisions/`, notable work in `vault/Log/`, and keep `vault/Now.md` current. Run `python vault/_meta/tools/check_vault.py` after editing the vault.
- **Trust levels.** Notes with an empty `verified:` field were migrated verbatim from the old skills on 2026-11-23. Confirm specifics against the code before relying on them.
- **No secrets in the vault.** Both GitHub repos are public: no keys, tokens, customer data or personal data in notes.
- **Brand name is Voco** — not HomeService AI, not homeserviceai. Fallback email domains use `voco.live`.
- **Request gating goes in `src/proxy.js`**, not `middleware.js`.
- **Never push to `main` in either repo without the owner's go-ahead.** Both deploy to production from `main`.
