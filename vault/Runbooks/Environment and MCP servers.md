---
type: runbook
status: current
description: "Which environment variables exist (names only), where they are set, and which MCP servers Claude can use to inspect live systems."
verified: 2026-11-23
tags: [voco/runbook]
---

# Environment and MCP servers

No values are recorded here. Both repos are public.

## Next app environment (names from `.env.local`; `.env.example` is the template)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_S3_*`
- LiveKit: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SIP_OUTBOUND_TRUNK_ID`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_SIP_TRUNK_SID`
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_API_KEY`, `GOOGLE_MAPS_API_KEY`
- Microsoft: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_{STARTER,GROWTH,SCALE}` plus `_ANNUAL` and `_OVERAGE` variants
- AI and voice: `OPENAI_API_KEY`, `GROQ_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_AI`, `ELEVENLABS_VOICE_ID_CALLER`
- Other: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `XERO_*`, `JOBBER_*`, `CRON_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_APP_URL`, `RAILWAY_WEBHOOK_URL`, `NEXT_ALLOWED_DEV_ORIGINS`

Production values live in Vercel. The agent's variables live in Railway; the list is in [[Voice Agent - Environment Variables]].

## MCP servers
| Server | Use | Notes |
|---|---|---|
| `supabase-voco` | SQL against the live database, list tables, apply migrations, logs | Configured in `.mcp.json` (gitignored). Project ref `exbzhmparzjlpkryeiso`. Prefer it over reading migration files to learn the live schema. |
| `railway` | Deployments, logs, variables for the agent service | Project `miraculous-love` |
| `stripe` | Stripe account inspection | Local server keyed to the app's test key: [[2026-06-16 Stripe MCP setup and billing audit]] |

## Local commands
- Next app: `npm run dev`, `npm test`, `npm run lint`, `npm run build`
- Agent: `python -m src.agent` (entrypoint from `livekit.toml`), `pytest`
