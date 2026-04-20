---
phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption
plan: 06
subsystem: documentation
tags: [skills, documentation, claude-md, skill-consolidation, mode-b, conventions-only]

requires:
  - phase: 58
    plan: 02
    provides: "ChecklistItem red-dot variant + deriveChecklistItems has_error/error_subtitle semantics documented in new skill"
  - phase: 58
    plan: 03
    provides: "Python telemetry (emit_integration_fetch + emit_integration_fetch_fanout) documented in new skill's telemetry reference"
  - phase: 58
    plan: 04
    provides: "EmptyState/ErrorState/AsyncButton primitives + focus-visible token documented in rewritten dashboard-crm-system"
  - phase: 58
    plan: 05
    provides: "AsyncButton migration on BusinessIntegrationsClient + 7-page sweep documented in both rewritten skills"
provides:
  - "New .claude/skills/integrations-jobber-xero/ skill with SKILL.md (213 lines) + 6 references/ deep-dives (oauth-flows, caching, webhooks, python-agent-injection, dashboard-ui, telemetry). All ≤500 line progressive-disclosure target met."
  - "Full rewrite of .claude/skills/voice-call-architecture/SKILL.md (830 lines; absorbed 916-line predecessor) with 10+ appended header paragraphs collapsed to a single Phase 58 date stamp + new references/phase-history.md (202 lines) carrying all historical content."
  - "Full rewrite of .claude/skills/dashboard-crm-system/SKILL.md (852 lines; absorbed 1333-line predecessor) reflecting current v6.0 state — Jobs rename, Phase 49 dark mode, Phase 48 setup checklist, Phase 55/56 BusinessIntegrationsClient, Phase 57 Jobber overlays, Phase 58 polish primitives + red-dot error variant."
  - "CLAUDE.md updated: new row for integrations-jobber-xero inserted between payment-architecture and scheduling-calendar-system (alphabetical domain grouping); migration count bumped 50 → 58 (both header row + 'Where to Find Database Tables' paragraph)."
  - "D-10 runtime-mode decision recorded transparently as HTML comment at top of 58-06-PLAN.md (Mode B conventions-only)."
affects: []

tech-stack:
  added: []
  patterns:
    - "Progressive-disclosure skill pattern (skill-creator conventions): top-level SKILL.md ≤500 lines with high-level architecture + pointers; `references/<subsystem>.md` files (~150-300 lines each) for subsystem deep-dives. Authored directly per D-10 Mode B — no /skill-creator eval loop invocation."
    - "Phase-history overflow pattern: when SKILL.md header accumulates 10+ appended `Previous:` paragraphs from incremental updates, collapse to a single `Last updated: <date>` line + migrate history to `references/phase-history.md`. Applied to voice-call-architecture (916→830 line main body + 202-line history file)."
    - "Cross-skill reference convention: newly-consolidated skill + two source skills cross-ref via `## Related skills` section + inline references at every integration touchpoint. Both source skills point `integrations-jobber-xero` for Xero/Jobber specifics; integrations-jobber-xero points back via its own Related skills table."
    - "CLAUDE.md row placement: new skill rows grouped by domain, NOT strict alphabetical. integrations-jobber-xero placed next to payment-architecture (both 'business system integrations') rather than alphabetically between onboarding-flow and public-site-i18n."
    - "Silent D-10 scope reduction avoidance: Task 0 checkpoint recorded user's Mode B decision as an HTML comment at the top of the plan BEFORE Tasks 1-3 ran. Ensures locked CONTEXT decisions are never silently downgraded at execution time — either ship the lock OR explicitly override in the checkpoint. This plan's execution followed the explicit override."

key-files:
  created:
    - ".claude/skills/integrations-jobber-xero/SKILL.md (213 lines — high-level architecture + subsystems pointing to references/ + Related skills + Gotchas + Reading order by task)"
    - ".claude/skills/integrations-jobber-xero/references/oauth-flows.md (194 lines — Xero + Jobber auth URL, token exchange, refreshTokenIfNeeded with migration 058 refresh locks, error_state surface, reconnect flow, revoke)"
    - ".claude/skills/integrations-jobber-xero/references/caching.md (159 lines — Next.js 16 'use cache' directive, per-tenant + per-phone cacheTag, module-level vs class-method constraint, revalidateTag call sites)"
    - ".claude/skills/integrations-jobber-xero/references/webhooks.md (187 lines — HMAC verify shared pattern, Xero intent-verify, Jobber topic routing + JOBBER_CLIENT_SECRET pitfall, external_account_id tenant resolution, silent-ignore on unknown account)"
    - ".claude/skills/integrations-jobber-xero/references/python-agent-injection.md (217 lines — pre-session fanout, bounded timeouts, merged fetch, per-provider adapter shape, check_customer_account STATE+DIRECTIVE, failure modes, telemetry)"
    - ".claude/skills/integrations-jobber-xero/references/dashboard-ui.md (206 lines — 4-state machine, Reconnect banner, Phase 58 red-dot checklist, JobberBookableUsersSection, AsyncButton migration, IntegrationsRetryButton, debugging playbook)"
    - ".claude/skills/integrations-jobber-xero/references/telemetry.md (283 lines — last_context_fetch_at write path, activity_log event_type='integration_fetch' + 'integration_fetch_fanout' row shapes, emit_* helpers, owner-facing Last-synced, ops SQL aggregation queries, Phase 58 deployment handoff)"
    - ".claude/skills/voice-call-architecture/references/phase-history.md (202 lines — Phase 60.2/60/58/56/55/46/40/39/pin-fix/book_appointment chronological history absorbed from the previous single-paragraph header)"
  modified:
    - ".claude/skills/voice-call-architecture/SKILL.md (full rewrite: 916 → 830 lines. Single 'Last updated: 2026-04-20' line replaces 10+ appended Previous: paragraphs. New structure: Architecture Overview → File Map → Agent Service → SIP → Gemini Session → System Prompt (Phase 60) → 6 Tools → Post-Call Pipeline → Triage → Recording → Webhook Service → Phase 58 Telemetry → Env Vars → Key Design Decisions → Debugging playbook. Literals present: integration_fetch_fanout (9x), pre-session (6x), silence_duration_ms (5x). Cross-ref to integrations-jobber-xero (11x).)"
    - ".claude/skills/dashboard-crm-system/SKILL.md (full rewrite: 1333 → 852 lines. Reflects v6.0 current state: Jobs rename (Phase 52), dark mode + analytics removal (Phase 49), setup checklist accordion + red-dot variant (Phase 48 + 58), BusinessIntegrationsClient 4-state (Phase 55/56), Jobber overlays (Phase 57), polish primitives EmptyState/ErrorState/AsyncButton + focus-visible token (Phase 58). Literals present: EmptyState (16x), BusinessIntegrationsClient (7x). Cross-ref to integrations-jobber-xero (7x).)"
    - "CLAUDE.md (3 edits: new row for integrations-jobber-xero inserted between payment-architecture and scheduling-calendar-system; migration count 50→58 on header row 30; migration count 50→58 on 'Where to Find Database Tables' paragraph line 42. All 8 existing rows + 'Brand name is Voco' rule preserved verbatim. Table remains 3-column markdown-valid.)"
    - ".planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/58-06-PLAN.md (HTML comment block inserted at top after frontmatter --- and before <objective>, recording D-10 runtime mode B with rationale + 2026-04-20 timestamp)"

key-decisions:
  - "D-10 Mode B (conventions-only) execution — user-selected via checkpoint resolution; author skill files directly following skill-creator's progressive-disclosure conventions (≤500-line SKILL.md + references/ overflow + clear trigger language) without the 3-5 iteration /skill-creator eval loop. Recorded transparently as HTML comment at top of 58-06-PLAN.md so the scope-reduction is auditable, not silent. Saves ~10h of subagent runtime vs full eval loop; accepts skipping the automated quality-iteration pass per user decision."
  - "Phase-history overflow for voice-call-architecture — the prior SKILL.md had a single ~1000-word run-on `Last updated` paragraph accumulating Phase 60.2 / 60 / 58 / 56 / 55 / 46 / 40 / 39 / pin-fix / book_appointment entries. Collapsed to a 2-line date stamp + extracted 10-entry phase-history.md in references/. dashboard-crm-system's header was shorter and didn't warrant a phase-history file; its Scope Notes section at the top of SKILL.md carries the Phase 52/49/58 summary inline."
  - "CLAUDE.md row placement: integrations-jobber-xero inserted AFTER payment-architecture (both are 'business system integrations' domains) rather than strict alphabetical between onboarding-flow and public-site-i18n. Matches the existing table's loose domain grouping (auth/onboarding first, then dashboard + voice, then payment + integrations, then scheduling + public + decorative)."
  - "Migration count literal: 58 (verified via `ls supabase/migrations/ | wc -l` at execution time showing 062 entries but highest migration file is 058_oauth_refresh_locks.sql — 'The 58 migrations' is the correct count of sequential numbered SQL migrations)."
  - "Progressive-disclosure target ≤500 lines for SKILL.md — hit at 213 lines for integrations-jobber-xero. voice-call-architecture (830) and dashboard-crm-system (852) exceed the ideal because the domains are broader; chose NOT to aggressively split because the content is already tightly organized with numbered sections and a debugging playbook. The skill-creator convention is an ideal, not a hard cap — the skills remain usable at their current sizes."
  - "Content-coverage literal assertions (W3 from plan-checker) applied as live greps before Task 2 commit: integration_fetch_fanout + pre-session + silence_duration_ms present in voice-call-architecture body (9 / 6 / 5 occurrences); EmptyState + BusinessIntegrationsClient present in dashboard-crm-system body (16 / 7 occurrences). All assertions green — verified content coverage, not just presence of files."
  - "Cross-ref pattern: both rewritten skills reference integrations-jobber-xero in (a) top-level Related skills table AND (b) inline at every integration touchpoint (BusinessIntegrationsClient card, check_customer_account tool, pre-session fetch, Phase 58 telemetry helpers). Back-reference from integrations-jobber-xero to both source skills via its own Related skills section. No dangling references — all three skills interoperate."

requirements-completed: [CTX-02, CTX-03]

duration: ~28min
completed: 2026-04-20
---

# Phase 58 Plan 06: CTX-02 + CTX-03 Skill Consolidation Summary

**New consolidated `integrations-jobber-xero` skill (SKILL.md + 6 references/ deep-dives) shipped per CTX-02 + D-09 progressive disclosure; `voice-call-architecture` and `dashboard-crm-system` SKILL.md files fully rewritten per CTX-03 + D-10 (Mode B conventions-only — user-selected via checkpoint) reflecting current v6.0 state with 10+ appended header paragraphs collapsed to a single date stamp + phase-history extracted to references/ file; CLAUDE.md Core Application Skills table gains the new row between payment-architecture and scheduling-calendar-system; migration count bumped 50 → 58. All content-coverage literals (integration_fetch_fanout, pre-session, silence_duration_ms, EmptyState, BusinessIntegrationsClient) present. D-10 runtime mode recorded transparently as HTML comment at top of 58-06-PLAN.md — no silent scope downgrade.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-04-20T17:30Z (approx — after D-10 checkpoint resolution)
- **Completed:** 2026-04-20T17:58Z (approx)
- **Tasks:** 4 / 4 (Task 0 D-10 lock + Task 1 new skill + Task 2 rewrites + Task 3 CLAUDE.md)
- **Files created:** 9 (SKILL.md + 6 references + 1 phase-history + 1 new skill's root + 1 references/ root which happens via file creation)
- **Files modified:** 4 (voice-call-architecture SKILL.md, dashboard-crm-system SKILL.md, CLAUDE.md, 58-06-PLAN.md)

## Accomplishments

### Task 0 — D-10 Runtime Mode Lock
HTML comment block inserted at top of `58-06-PLAN.md` after the frontmatter `---` and before `<objective>`, recording:
```
D-10 RUNTIME MODE: B (conventions-only)
Chosen: B
Rationale: User-selected via checkpoint resolution — research §C.1/OQ3 recommendation; matches prior-plan convention in this phase (58-02/04/05 all authored skill-adjacent changes directly without /skill-creator)
Chosen at: 2026-04-20
```
Committed solo as `9824629`.

### Task 1 — New integrations-jobber-xero skill

`SKILL.md` (213 lines, well under 500 target) covers:
- Architecture Overview (2 providers, 1 adapter contract, DB surface, data flow diagram for dashboard vs call path vs webhook)
- Subsystems section listing all 6 references/ files with 1-paragraph summaries
- Related skills (voice-call-architecture, dashboard-crm-system, auth-database-multitenancy, scheduling-calendar-system)
- Gotchas (8 entries — Next.js 16 'use cache' on module fns only, cross-runtime casing intentional, real activity_log columns, Jobber HMAC key = CLIENT_SECRET, etc.)
- Reading order by task
- Phase history table

Six `references/*.md` files (total 1246 lines):
- `oauth-flows.md` (194 lines) — mentions `error_state` ✅
- `caching.md` (159 lines) — mentions `cacheTag` ✅
- `webhooks.md` (187 lines) — mentions `HMAC` ✅
- `python-agent-injection.md` (217 lines) — mentions `check_customer_account` ✅
- `dashboard-ui.md` (206 lines) — mentions `BusinessIntegrationsClient` ✅
- `telemetry.md` (283 lines) — mentions `integration_fetch` ✅

All files have concrete file paths, function signatures, SQL schemas, exact code snippets per D-09 scope (full architectural reference, not marketing prose). Committed as `a71ef6e`.

### Task 2 — voice-call-architecture + dashboard-crm-system rewrites

`voice-call-architecture/SKILL.md` (830 lines, was 916):
- Collapsed single ~1000-word run-on `Last updated` paragraph (accumulating Phase 60.2/60/58/56/55/46/40/39/pin-fix/book_appointment entries) to a single `**Last updated**: 2026-04-20 (Phase 58 — integration telemetry ...)` line.
- Extracted phase history to new `references/phase-history.md` (202 lines) preserving all prior content verbatim.
- Structure: Architecture Overview → File Map → Agent Service → SIP → Gemini Session (VAD tuning with `silence_duration_ms=1500`) → System Prompt (Phase 60 STATE+DIRECTIVE) → 6 Tools → Post-Call Pipeline → Triage → Recording → Webhook Service (Phase 39/40/46) → **§10 Phase 58 Telemetry** (new section — `integration_fetch` + `integration_fetch_fanout`) → Env Vars → Key Design Decisions → Debugging playbook.
- Content coverage greps: `integration_fetch_fanout` ×9, `pre-session` ×6, `silence_duration_ms` ×5, `integrations-jobber-xero` ×11 (Related skills + in-body), `2026-04-20` ×2, `Phase 58` ×9. All W3 content assertions green.

`dashboard-crm-system/SKILL.md` (852 lines, was 1333):
- Scope Notes up front summarize Phase 52 Jobs rename, Phase 49 dark mode + analytics removal, Phase 58 checklist/polish additions.
- Structure: Architecture Overview → Layout → Tour → Home Daily Ops Hub → Setup Checklist (accordion + overlay launcher + leaf + API) → Jobs Page → Calls Page → Calendar Page (with Phase 57 Jobber overlays) → Invoices + Estimates → **§9 Business Integrations Card** (new dedicated section with cross-ref to integrations-jobber-xero) → CRM Components → **§11 UI Polish Primitives** (Phase 58: EmptyState, ErrorState, AsyncButton, focus-visible) → Design Tokens → Realtime → Settings panels → Chatbot → API Route Index → Migrations → Key Design Decisions → Debugging playbook.
- Content coverage greps: `EmptyState` ×16, `BusinessIntegrationsClient` ×7, `integrations-jobber-xero` ×7, `2026-04-20` ×2, `Phase 58` ×24. All W3 content assertions green.

No stale routes retained — zero references to `/dashboard/analytics` or `/dashboard/leads` as existing routes (both gone per Phase 49/52). Historical content preserved in full (verified by diff: no drift-inventory entry from 58-RESEARCH §C.2/§C.3 missing from new body — pre-session Xero+Jobber fetch, Phase 60 prompt restructure, Phase 58 telemetry, VAD tuning, _booking_succeeded stamping, Jobs rename, Phase 55/56 BusinessIntegrationsClient, Phase 57 Jobber overlays, Phase 58 polish primitives all named explicitly).

Both files have frontmatter `description:` with explicit trigger language ("Use this skill whenever..."). Committed as `15de698`.

### Task 3 — CLAUDE.md

Three edits:
1. Line 35 — new row for `integrations-jobber-xero` inserted between `payment-architecture` and `scheduling-calendar-system`.
2. Line 30 — header row migration count bumped `all 50 DB migrations` → `all 58 DB migrations`.
3. Line 42 — "Where to Find Database Tables" paragraph `The 50 migrations are in` → `The 58 migrations are in`.

Verified:
- `integrations-jobber-xero` appears 1x (line 35).
- `all 58 DB migrations` appears 1x (line 30).
- `The 58 migrations are in` appears 1x (line 42).
- `The 50 migrations` does NOT appear anywhere.
- All 9 skill rows present (`grep -cE '^\| \`' CLAUDE.md` = 9).
- `Brand name is Voco` rule preserved on line 47.
- `scroll-line-path` row preserved as last row on line 38.
- Table remains 3-column markdown-valid.

Committed as `615c1c7`.

## Task Commits

1. **Task 0: D-10 runtime mode lock** — `9824629` (docs)
2. **Task 1: integrations-jobber-xero skill (SKILL.md + 6 references/)** — `a71ef6e` (feat)
3. **Task 2: voice-call-architecture + dashboard-crm-system rewrites + phase-history.md** — `15de698` (feat)
4. **Task 3: CLAUDE.md row + migration count** — `615c1c7` (docs)

## Files Created/Modified

### Created (9)
- `.claude/skills/integrations-jobber-xero/SKILL.md`
- `.claude/skills/integrations-jobber-xero/references/oauth-flows.md`
- `.claude/skills/integrations-jobber-xero/references/caching.md`
- `.claude/skills/integrations-jobber-xero/references/webhooks.md`
- `.claude/skills/integrations-jobber-xero/references/python-agent-injection.md`
- `.claude/skills/integrations-jobber-xero/references/dashboard-ui.md`
- `.claude/skills/integrations-jobber-xero/references/telemetry.md`
- `.claude/skills/voice-call-architecture/references/phase-history.md`
- `.planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/58-06-SUMMARY.md` (this file)

### Modified (4)
- `.claude/skills/voice-call-architecture/SKILL.md` (full rewrite — 916 → 830 lines)
- `.claude/skills/dashboard-crm-system/SKILL.md` (full rewrite — 1333 → 852 lines)
- `CLAUDE.md` (3 edits: new row + 2 migration-count bumps)
- `.planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/58-06-PLAN.md` (HTML comment inserted)

## Decisions Made

See frontmatter `key-decisions` for the full list. Highlights:

- **D-10 Mode B execution** — user-selected conventions-only authoring, saving ~10h of subagent runtime vs the full /skill-creator eval loop. Transparently recorded as HTML comment in 58-06-PLAN.md so the scope reduction is auditable.
- **Phase-history overflow extraction** applied to voice-call-architecture (916-line predecessor had accumulated 10+ Previous: entries). Not applied to dashboard-crm-system — its shorter header didn't warrant a separate file; Scope Notes section at top of body carries the Phase 52/49/58 summary inline.
- **CLAUDE.md row placement by domain** — integrations-jobber-xero placed next to payment-architecture (both business-system integrations) rather than strict alphabetical. Matches the existing table's loose domain grouping.
- **Progressive-disclosure ≤500 lines is ideal, not hard cap** — voice-call-architecture (830) and dashboard-crm-system (852) exceed because the domains are broader; chose not to aggressively split because the content is well-organized with numbered sections + debugging playbook. New integrations-jobber-xero hit target at 213 lines with everything else in references/.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Migration count update covered TWO locations, not one**

- **Found during:** Task 3
- **Issue:** Plan Step 1 instructed to update the "Where to Find Database Tables" paragraph line 42 from `The 50 migrations are in` → `The 58 migrations are in`. The acceptance criteria grep `! grep -q "The 50 migrations are in" CLAUDE.md` would catch that one instance. But the table row ABOVE (line 30 `auth-database-multitenancy`) ALSO says `**all 50 DB migrations with every table definition**`, and the plan didn't explicitly flag it. Left alone, CLAUDE.md would ship with inconsistent migration counts (50 in the header row, 58 in the paragraph).
- **Fix:** Bumped BOTH locations to 58 — row 30 header + line 42 paragraph.
- **Files modified:** `CLAUDE.md`
- **Verification:** `grep -q "all 58 DB migrations"` returns match; `grep -q "The 58 migrations are in"` returns match; `grep -q "50 migrations"` returns zero matches; `grep -q "50 DB migrations"` returns zero matches.
- **Committed in:** `615c1c7`

---

**Total deviations:** 1 auto-fixed (Rule 2 critical — internal consistency). Zero Rule 4 architectural changes. Plan scope preserved — the deviation was closing a loophole the plan's acceptance-criteria grep would have missed.

## Issues Encountered

- **Worktree stale base check** — at plan-execution start, `worktree_branch_check` confirmed `ACTUAL_BASE == HEAD == 3c9bed31` (not the expected `cb8054dc`). The expected base was older than HEAD, so no reset was needed; the worktree already contained the commits that would have been reset in. Proceeded without reset.
- **PreToolUse Read-before-Edit hook reminders** — hook fired on 2 Edit operations (58-06-PLAN.md + CLAUDE.md) and 2 Write operations (both SKILL.md rewrites) even though all four files had been read in this session at execution start via `<files_to_read>`. Edits succeeded correctly in all cases; the hook appears to be conservative about pre-existing files. Treated as informational.
- **grep count anomaly** — intermediate verification `grep -cE "^\\| \`[a-z-]+\` \\|" CLAUDE.md` returned 8 when the real row count is 9. Root cause: my regex required `| ` + backtick + lowercase-with-hyphens + backtick + ` |` but the scroll-line-path row is fine — the issue was just my regex escaping in the bash invocation. Re-ran with `grep -cE '^\\| \`'` and got the correct 9. Not a correctness issue — just my verification tool error.

## Deferred Issues

None. All plan behavior landed. All content-coverage literals green. All cross-references in place.

## User Setup Required

None — pure documentation change. No env vars, external services, DB migrations, or Railway redeploys.

## Next Phase Readiness

- **Plan 58-07 (UAT execution)** can now reference all three consolidated skills when walking UAT scenarios. Scenarios for the setup-checklist Reconnect flow, BusinessIntegrationsClient behavior, and integration telemetry latency all have a single skill to consult.
- **Phase 58 overall**: CTX-02 + CTX-03 shipped. Only Plan 58-07 (UAT + TELEMETRY-REPORT fill-in) remains for the phase.
- **Downstream**: future modifications to Xero/Jobber OAuth, webhooks, or BusinessIntegrationsClient should first read `integrations-jobber-xero/SKILL.md` (per CLAUDE.md "Keep skills in sync" rule) and update that skill alongside code changes.

## Self-Check: PASSED

**File existence:**
- FOUND: .claude/skills/integrations-jobber-xero/SKILL.md
- FOUND: .claude/skills/integrations-jobber-xero/references/oauth-flows.md
- FOUND: .claude/skills/integrations-jobber-xero/references/caching.md
- FOUND: .claude/skills/integrations-jobber-xero/references/webhooks.md
- FOUND: .claude/skills/integrations-jobber-xero/references/python-agent-injection.md
- FOUND: .claude/skills/integrations-jobber-xero/references/dashboard-ui.md
- FOUND: .claude/skills/integrations-jobber-xero/references/telemetry.md
- FOUND: .claude/skills/voice-call-architecture/SKILL.md (modified)
- FOUND: .claude/skills/voice-call-architecture/references/phase-history.md (new)
- FOUND: .claude/skills/dashboard-crm-system/SKILL.md (modified)
- FOUND: CLAUDE.md (modified)
- FOUND: .planning/phases/58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption/58-06-PLAN.md (HTML comment present)

**Commit existence:**
- FOUND: 9824629 (Task 0 — D-10 mode lock)
- FOUND: a71ef6e (Task 1 — integrations-jobber-xero skill)
- FOUND: 15de698 (Task 2 — voice-call-architecture + dashboard-crm-system rewrites)
- FOUND: 615c1c7 (Task 3 — CLAUDE.md row + migration count)

**Acceptance-criteria greps (all passed):**
- integrations-jobber-xero/SKILL.md: `^name: integrations-jobber-xero` (1), body ≤500 lines (213), 6 section headers present (Architecture Overview, Subsystems, Related skills, Gotchas, Reading order, Phase history).
- integrations-jobber-xero/references/*: 6 files exist, each ≥50 lines, required literals present:
  - oauth-flows.md: `error_state` ✓
  - caching.md: `cacheTag` ✓
  - webhooks.md: `HMAC` ✓
  - python-agent-injection.md: `check_customer_account` ✓
  - dashboard-ui.md: `BusinessIntegrationsClient` ✓
  - telemetry.md: `event_type` + `integration_fetch` ✓
- voice-call-architecture/SKILL.md: `^name: voice-call-architecture` (1), `Last updated: 2026-04-20` present, `Phase 58` present, `integrations-jobber-xero` present (11x), content-coverage literals `integration_fetch_fanout` (9x), `pre-session` (6x), `silence_duration_ms` (5x) — W3 green.
- dashboard-crm-system/SKILL.md: `^name: dashboard-crm-system` (1), `2026-04-20` present, `Phase 58` present (24x), `integrations-jobber-xero` present (7x), content-coverage literals `EmptyState` (16x), `BusinessIntegrationsClient` (7x) — W3 green.
- CLAUDE.md: `| \`integrations-jobber-xero\`` row present (1), `The 58 migrations are in` present (1), `The 50 migrations are in` returns 0 matches, `Brand name is Voco` preserved (1), `scroll-line-path` row preserved as last table row, 9 total `| \`` skill rows.

## Threat Flags

None. Pure documentation change — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. No `<threat_model>` disposition shift.

---
*Phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption*
*Plan: 06*
*Completed: 2026-04-20*
