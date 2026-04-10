---
phase: 44-ai-voice-selection
plan: "01"
subsystem: ai-voice-backend
tags: [database, api, validation, audio, skill-update]
dependency_graph:
  requires: []
  provides:
    - ai_voice column on tenants table
    - PATCH /api/ai-voice-settings endpoint
    - 6 placeholder MP3 audio files at /public/audio/voices/
    - ai-voice-validation pure validation module
  affects:
    - supabase/migrations (adds 044)
    - src/app/api/ai-voice-settings/route.js (new)
    - src/lib/ai-voice-validation.js (new)
    - .claude/skills/auth-database-multitenancy/SKILL.md
tech_stack:
  added:
    - src/lib/ai-voice-validation.js (pure validation module, VALID_VOICES + isValidVoice)
  patterns:
    - getTenantId() auth guard pattern (canonical PATCH route pattern)
    - Pure function extraction for testability (Phase 37 precedent)
    - Source file inspection testing pattern (Phase 37/38 precedent)
key_files:
  created:
    - supabase/migrations/044_ai_voice_column.sql
    - src/app/api/ai-voice-settings/route.js
    - src/lib/ai-voice-validation.js
    - tests/unit/ai-voice-settings.test.js
    - public/audio/voices/aoede.mp3
    - public/audio/voices/erinome.mp3
    - public/audio/voices/sulafat.mp3
    - public/audio/voices/zephyr.mp3
    - public/audio/voices/achird.mp3
    - public/audio/voices/charon.mp3
  modified:
    - .claude/skills/auth-database-multitenancy/SKILL.md
decisions:
  - "Pure validation extracted to src/lib/ai-voice-validation.js for ESM testability (no Supabase deps in test env)"
  - "Test strategy: pure function tests + source inspection (Phase 37 precedent — jest.unstable_mockModule unusable without jest global in ESM context)"
  - "Minimal MP3 files (427 bytes, ID3v2 header + 1 silent MPEG1 frame) created via Node.js since ffmpeg unavailable"
  - "Migration numbered 044 — 042 and 043 exist, 044 was available (045 taken by SMS migration)"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-10"
  tasks_completed: 3
  tasks_total: 3
  files_created: 10
  files_modified: 1
---

# Phase 44 Plan 01: AI Voice Selection Backend Summary

**One-liner**: DB migration + PATCH API + 6 placeholder MP3 files for AI voice selection, with pure validation module and skill update.

## What Was Built

### Task 1: DB Migration + API Route + Unit Tests
- `supabase/migrations/044_ai_voice_column.sql`: Adds `ai_voice TEXT` column to tenants with case-sensitive CHECK constraint for 6 Gemini voices (Aoede, Erinome, Sulafat, Zephyr, Achird, Charon). Nullable — NULL means fallback to VOICE_MAP[tone_preset].
- `src/lib/ai-voice-validation.js`: Pure validation module exporting `VALID_VOICES` array and `isValidVoice()` function. No external dependencies — directly testable in Jest ESM environment.
- `src/app/api/ai-voice-settings/route.js`: PATCH endpoint following canonical `getTenantId()` + service role client pattern. Imports validation from pure lib. Returns 401 (no auth), 400 (invalid voice), 200 (success).
- `tests/unit/ai-voice-settings.test.js`: 19 tests covering VALID_VOICES contents, isValidVoice for all 6 valid voices, invalid voice, lowercase rejection, empty/undefined, and route source structure validation (7 assertions).

### Task 2: Placeholder Audio Files
- 6 minimal valid MP3 files (427 bytes each) at `public/audio/voices/{aoede,erinome,sulafat,zephyr,achird,charon}.mp3`
- Created via Node.js (ffmpeg unavailable): ID3v2 header + 1 silent MPEG1 Layer3 frame
- Per D-10: owner will provide real voice sample audio to replace these

### Task 3: Auth-Database-Multitenancy Skill Update
- File Map: added `044_ai_voice_column.sql` entry
- Migration Trail: added full `044_ai_voice_column.sql` section documenting the new column, CHECK constraint, backward compat design, and API route reference
- Complete Table Reference: added `ai_voice` to tenant columns added across migrations list

## Verification

All success criteria met:
- `npx jest tests/unit/ai-voice-settings.test.js --no-coverage` — 19/19 PASS
- `ls public/audio/voices/*.mp3 | wc -l` — 6
- `grep -c "ALTER TABLE tenants" supabase/migrations/044_ai_voice_column.sql` — 1
- `grep -c "ADD COLUMN ai_voice TEXT" supabase/migrations/044_ai_voice_column.sql` — 1
- `grep -c "export async function PATCH" src/app/api/ai-voice-settings/route.js` — 1
- `grep -c "ai_voice" .claude/skills/auth-database-multitenancy/SKILL.md` — 6

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESM jest.mock() incompatible with node --experimental-vm-modules**

- **Found during:** Task 1 (TDD RED phase)
- **Issue:** `jest.mock()` and `jest.unstable_mockModule()` both require `jest` global which is not injected in ESM module context with `--experimental-vm-modules`. Route uses Supabase which fails without env vars.
- **Fix:** Extracted pure validation logic (`VALID_VOICES`, `isValidVoice`) to `src/lib/ai-voice-validation.js` (no Supabase dep). Tests cover pure function behavior + route source structure via `readFileSync` inspection. 19 tests, all pass. This follows Phase 37 precedent exactly.
- **Files modified:** `src/lib/ai-voice-validation.js` (new), `tests/unit/ai-voice-settings.test.js` (restructured), `src/app/api/ai-voice-settings/route.js` (imports from validation lib)
- **Commits:** b061bb6

**2. [Rule 3 - Blocking] ffmpeg not available for MP3 generation**

- **Found during:** Task 2
- **Issue:** Plan suggested ffmpeg for generating silent MP3 files; ffmpeg is not installed.
- **Fix:** Used Node.js to write minimal valid MP3 binary (ID3v2 header + 1 MPEG1 silent frame, 427 bytes) — sufficient for `new Audio()` browser load without 404. Plan explicitly allows this fallback.
- **Files modified:** public/audio/voices/*.mp3 (6 files)
- **Commits:** e89887d

## Known Stubs

- **public/audio/voices/*.mp3** — Placeholder audio files (1 silent frame, 427 bytes each). Per D-10, owner will provide real pre-recorded voice samples. Plan 02 (voice picker UI) will reference these files; stubs prevent 404s during development. Real files will not require any code change — same paths, different content.

## Self-Check: PASSED

Files verified:
- supabase/migrations/044_ai_voice_column.sql: FOUND
- src/app/api/ai-voice-settings/route.js: FOUND
- src/lib/ai-voice-validation.js: FOUND
- tests/unit/ai-voice-settings.test.js: FOUND
- public/audio/voices/aoede.mp3: FOUND (6/6 MP3s)
- .claude/skills/auth-database-multitenancy/SKILL.md: updated (6 ai_voice references)

Commits verified:
- b061bb6: feat(44-01): DB migration + API route + unit tests
- e89887d: feat(44-01): add placeholder MP3 audio files
- 09b35af: docs(44-01): update skill
