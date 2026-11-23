---
type: system
system: Public Site
status: pending-rebuild
description: "Cookie-based locale, no URL prefix: The app uses next-intl with cookie-based locale switching rather than URL-prefixed routing (e.g., /es/pricing). This is r… Covers: Routing Config (`src/i18n/routing.js`); Translation Files Structure"
source: .claude/skills/public-site-i18n/SKILL.md § 12. Internationalization (i18n)
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Internationalization (i18n)

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

### Routing Config (`src/i18n/routing.js`)

```js
export const locales = ['en', 'es'];
export const defaultLocale = 'en';
```

**Cookie-based locale, no URL prefix**: The app uses `next-intl` with cookie-based locale switching rather than URL-prefixed routing (e.g., `/es/pricing`). This is required by the API-first multi-tenant architecture — URL prefixes would break webhook routing and OAuth callbacks.

**Single source of truth for language barrier detection**: The voice call system imports `locales` from this file to detect unsupported languages. Any detected_language not in the `locales` array → `language_barrier = true`. Adding a new language means updating both this file AND the translation files.

### Translation Files Structure

Both `messages/en.json` and `messages/es.json` have two top-level sections:

**`agent` section** — used by the LiveKit voice agent (`src/prompt.py`) via direct JSON import (NOT next-intl runtime — the Railway agent runs outside Next.js context):
- `default_greeting`, `recording_disclosure`, `language_clarification`
- `unsupported_language_apology`, `call_wrap_up`, `transfer_attempt`
- `capture_name`, `capture_address`, `capture_job_type`
- `fallback_no_booking`, `language_barrier_escalation`

**`ui` section** — used by Next.js frontend via `next-intl` for UI text translations.

**Direct JSON import vs next-intl**: `build_system_prompt()` on Railway imports `messages/en.json` and `messages/es.json` directly (not via next-intl provider). This is because it runs in a Python process with no Next.js context. Frontend components use `next-intl`'s `useTranslations()` hook normally.

Cross-domain: See voice-call-architecture skill for how `buildSystemPrompt()` uses translation files.

---
