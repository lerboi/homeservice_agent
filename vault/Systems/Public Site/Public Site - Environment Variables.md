---
type: system
system: Public Site
status: pending-rebuild
description: "Environment variables Public Site reads, and where they are set."
source: .claude/skills/public-site-i18n/SKILL.md § 15. Environment Variables
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Environment Variables

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

| Variable | Used By | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | `src/app/api/public-chat/route.js` | Groq API key for public chatbot (Llama 4 Scout); 503 if missing |
| `ELEVENLABS_API_KEY` | `src/app/api/demo-voice/route.js` | ElevenLabs TTS API key (server-side only, never exposed to client) |
| `ELEVENLABS_VOICE_ID_AI` | `src/app/api/demo-voice/route.js` | Voice ID for AI receptionist dynamic name segment |
| `ELEVENLABS_VOICE_ID_CALLER` | Pre-render only | Voice ID for caller (used when pre-rendering static MP3 segments; not used at runtime) |
| `RESEND_API_KEY` | `src/app/api/contact/route.js` | Resend API key for contact form email dispatch |
| `RESEND_FROM_EMAIL` | `src/app/api/contact/route.js` | Sender email address |
| `CONTACT_EMAIL_SALES` | `src/app/api/contact/route.js` | Recipient for sales inquiry type |
| `CONTACT_EMAIL_SUPPORT` | `src/app/api/contact/route.js` | Recipient for support inquiry type |
| `CONTACT_EMAIL_PARTNERSHIPS` | `src/app/api/contact/route.js` | Recipient for partnerships inquiry type |
| `CONTACT_EMAIL_FALLBACK` | `src/app/api/contact/route.js` | Fallback recipient when no type-specific address configured |

---
