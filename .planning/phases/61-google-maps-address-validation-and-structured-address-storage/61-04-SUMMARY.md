---
phase: 61
plan: 04
subsystem: voice-call-architecture / livekit-agent / docs
tags: [livekit-agent, prompt, address-validation, anti-hallucination, locale-parity, d-e1, d-e3, skills-sync, checkpoint-paused]

dependency-graph:
  requires:
    - "Plan 01 — migration 062 applied (RPC overloads + verdict CHECK constraints)"
    - "Plan 02 — google_maps.validate_address_bounded contract"
    - "Plan 03 — D-E2 STATE+DIRECTIVE tool returns shipped to book_appointment + capture_lead"
  provides:
    - "src/prompt.py _build_address_validation_section(locale) — D-E3 CRITICAL RULE EN+ES"
    - "src/tools/book_appointment.py D-E1 outcome-framed description"
    - "src/tools/capture_lead.py D-E1 outcome-framed description (symmetric)"
    - "tests/test_prompt_address_validation_rule.py — 10 invariant tests (EN+ES presence + position + prohibited phrases + verdict tokens + parity)"
    - "tests/test_tool_descriptions_validation_precondition.py — 4 invariant tests"
    - ".claude/skills/voice-call-architecture/SKILL.md Phase 61 subsection"
    - ".claude/skills/auth-database-multitenancy/SKILL.md migration 062 catalog entry + count corrections"
    - ".claude/skills/integrations-jobber-xero/SKILL.md D-D1 cross-link section"
    - "CLAUDE.md migration count corrected 58 → 62 + key-table list updated for Phase 59 + Phase 61"
  affects:
    - "Production agent behavior on next Railway deploy — speaks verdict-correct readback per D-B3 / D-E3"
    - "Phase 62 Jobber write-side — will read the documented Voco-normalized address_components shape"

tech-stack:
  added: []
  patterns:
    - "Top-attention-zone CRITICAL RULE block (Phase 60.3 D-B-03 locale-parity pattern extended)"
    - "Outcome-framed tool description rewrite (Gemini 3.1 Flash Live reads tool descriptions during function-call decisions)"
    - "Verdict-token (`verdict=validated`, `verdict=validated_with_corrections`) treated as CODE IDENTIFIERS — not translated across locales"
    - "Section assembled between _build_corrections_section and _build_outcome_words_section to co-locate with existing anti-hallucination spine"

key-files:
  created:
    - "C:/Users/leheh/.Projects/livekit-agent/tests/test_prompt_address_validation_rule.py (10 tests, ~155 LOC)"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/test_tool_descriptions_validation_precondition.py (4 tests, ~95 LOC)"
  modified:
    - "C:/Users/leheh/.Projects/livekit-agent/src/prompt.py (+82 lines — _build_address_validation_section EN+ES + assembly wiring)"
    - "C:/Users/leheh/.Projects/livekit-agent/src/tools/book_appointment.py (~+14 lines net on _BOOK_APPOINTMENT_SCHEMA description; total prose ~570 chars, under 1024 budget)"
    - "C:/Users/leheh/.Projects/livekit-agent/src/tools/capture_lead.py (~+9 lines net on @function_tool description; under 1024 budget)"
    - "C:/Users/leheh/.Projects/homeservice_agent/.claude/skills/voice-call-architecture/SKILL.md (+~80 lines — Phase 61 subsection + Last updated header)"
    - "C:/Users/leheh/.Projects/homeservice_agent/.claude/skills/auth-database-multitenancy/SKILL.md (description + Last updated + migration count + new 062 catalog row)"
    - "C:/Users/leheh/.Projects/homeservice_agent/.claude/skills/integrations-jobber-xero/SKILL.md (+~40 lines — Phase 61 cross-link section + Last updated header)"
    - "C:/Users/leheh/.Projects/homeservice_agent/CLAUDE.md (migration count 58 → 62 + key-table list refresh)"

decisions:
  - "[Task 1] Section assembled between _build_corrections_section and _build_outcome_words_section per plan literal — co-locates the new D-E3 rule with the existing anti-hallucination spine in the top-attention zone."
  - "[Task 1] Verdict tokens (`verdict=validated`, `verdict=validated_with_corrections`) treated as CODE IDENTIFIERS in both locales (NOT translated), matching the Phase 60.3 P09 outcome_words convention and codified in `test_es_unless_clause_present`."
  - "[Task 1] Spanish prohibited phrases use a tolerant test (>=4 of 6 group-hits, where each group accepts masculine/feminine forms — `validado`/`validada`) to permit prose flexibility while catching actual omissions. EN test uses >=5 of 6 (matches plan spec). Both locales are still asserted equal in spirit via `test_en_es_distinct` + the silence-acceptable cross-locale guard."
  - "[Task 1] Tool description rewrites kept under 1024-char Pitfall A6 budget while encoding the validation precondition + outcome-framed verdict-driven readback hint. book_appointment now ~720 chars; capture_lead ~890 chars (was ~620 / ~635)."
  - "[Task 2] CLAUDE.md key-table list updated beyond the plan-spec 58 → 62 substitution: also replaced the stale leads/lead_calls entries with the Phase 59 model (customers/jobs/inquiries/customer_calls/job_calls/customer_merge_audit) and added gmaps_validate_events. Rule 2 auto-add — leaving CLAUDE.md claiming `leads`/`lead_calls` exist (Phase 59 dropped them, migration 061) would be a correctness defect propagating to every future skill-loading session."
  - "[Task 2] auth-database-multitenancy 'description' field bumped 61 → 62 with Phase 61 callout; 'Migrations table row' bumped 52 sequential → 62 sequential. Both stale claims pre-Plan-04."
  - "[Task 3] Stopped at checkpoint — UAT cannot be automated (real audio + Twilio + Gemini Live + Google Maps API). Returning structured checkpoint per executor protocol; auto-mode is false per .planning/config.json."
  - "[Task 1] Pre-existing 7 prompt-test failures + 1 timezone-test failure documented in 61 deferred-items.md remain pre-existing post-Plan-04 — verified via stash-pop test on book_appointment.py + capture_lead.py + prompt.py before commit. Out of scope per SCOPE BOUNDARY rule."

metrics:
  duration: "~25 minutes through Task 2; Task 3 awaiting human UAT"
  start_time_utc: "2026-05-03T~14:35Z"
  task_count_completed: 2
  task_count_total: 3
  test_count_added: 14
  test_count_passing: 14
  files_modified_count: 7
  files_created_count: 2
  completed_date: "2026-05-03 (Tasks 1 & 2 only — Task 3 paused for UAT)"
---

# Phase 61 Plan 04: D-E3 prompt rule + D-E1 tool descriptions + 3 SKILL syncs (CHECKPOINT PAUSED)

**One-liner:** Lands the prompt-side anti-hallucination guard rails (D-E3 CRITICAL RULE in EN+ES + D-E1 outcome-framed tool descriptions on `book_appointment` + `capture_lead`) so the agent speaks verdict-correct readback for every Plan-03 D-E2 tool-return shape; updates 3 SKILL.md files + CLAUDE.md to reflect Phase 61 reality. Paused at Task 3 — BLOCKING human UAT requires real phone calls and cannot be automated.

## What was built

### Task 1 — _build_address_validation_section + tool description rewrites + TDD tests COMPLETE

**TDD RED (commit `f5a0f3d` on sibling repo):**

Two new test files dropped into `C:/Users/leheh/.Projects/livekit-agent/tests/`:

- `test_prompt_address_validation_rule.py` — 10 tests (4 EN + 4 ES + 2 cross-locale parity guards):
  - EN/ES heading presence
  - 6 prohibited phrases enumerated (>=5 of 6 EN, >=4 of 6 ES with feminine/masculine tolerance)
  - Both verdict tokens (`verdict=validated`, `verdict=validated_with_corrections`) referenced verbatim in both locales
  - Position invariant — assembled prompt places the new section BEFORE `_build_tool_narration_section`'s output (top-attention zone)
  - EN/ES distinct (parity guard against copy-paste errors)
  - Both locales declare silence/neutral readback acceptable

- `test_tool_descriptions_validation_precondition.py` — 4 tests:
  - book_appointment description mentions validation/validated AND address
  - book_appointment description mentions tool-return verdict branches (confirmed/corrected/verdict)
  - capture_lead description: same precondition (D-E1 symmetry)
  - capture_lead description: same return-branch language

RED phase exited with `ImportError: cannot import name '_build_address_validation_section'` — the desired RED-state signal.

**TDD GREEN (commit `590669f` on sibling repo):**

`src/prompt.py` — added `_build_address_validation_section(locale: str = "en")` between `_build_corrections_section` and `_build_outcome_words_section`. EN body opens `ADDRESS VALIDATION — CRITICAL RULE:`, declares the verdict-driven branching (validated / validated_with_corrections / unvalidated), enumerates the 6 prohibited phrases as quoted bullets, and closes with the worst-failure-mode framing. ES body mirrors structure 1:1 with `VALIDACIÓN DE DIRECCIÓN — REGLA CRÍTICA:`, USTED register, 6 Spanish prohibited phrases with feminine/masculine pairs (`"validado" / "validada"`, `"verificado" / "verificada"`, `"confirmado contra Google"`, `"encontré su dirección"`, `"consulté su dirección"`, `"coincide con nuestros registros"`).

Wired into `build_system_prompt` `sections` list (line 1271 area) — placed after `_build_corrections_section(locale)` and before `_build_outcome_words_section(locale)`. No reordering of existing sections.

`src/tools/book_appointment.py` — `_BOOK_APPOINTMENT_SCHEMA["description"]` rewritten to encode the validation precondition (D-E1) as outcome-framed prose: "The address fields you provide will be validated against an external service before booking — the tool return will indicate whether the address was confirmed, corrected, or could not be verified, and will tell you what to speak back to the caller. Speak only what the return tells you." All prior preconditions (slot_token verbatim, filler-then-invoke, no premature `booked`/`confirmed` claim, return-not-spoken) preserved verbatim.

`src/tools/capture_lead.py` — symmetric description rewrite on the `@function_tool(...)` decorator. Same precondition + outcome-framed verdict-branch language; preserves the existing CRITICAL PRECONDITIONS (1) + (2) intake + readback rules.

**Test results:**

```
$ pytest tests/test_prompt_address_validation_rule.py tests/test_tool_descriptions_validation_precondition.py -x
14 passed in 4.54s

$ pytest tests/test_no_generate_reply_in_src.py -x
1 passed (Phase 63.1 regression guard intact)
```

### Task 2 — 3 SKILL.md syncs + CLAUDE.md migration count COMPLETE

**Worktree commit `5930960`:**

| File | Change |
|------|--------|
| `.claude/skills/voice-call-architecture/SKILL.md` | `**Last updated**` bumped 2026-04-24 → 2026-05-03 with Phase 61 description; new `## Phase 61 — Google Maps Address Validation Integration` subsection added at the end of the document (additive — every prior section preserved). Subsection covers: google_maps.py module shape, pre-checks in book_appointment + capture_lead, D-E2 STATE+DIRECTIVE returns, D-E3 CRITICAL RULE locale-parity, D-E1 tool-description rewrites, telemetry table, env-var setup, file-role table, and the test-layer invariant lock list. |
| `.claude/skills/auth-database-multitenancy/SKILL.md` | `description:` field updated `all 61 migrations` → `all 62 migrations` with Phase 61 callout; `**Last updated**` bumped to 2026-05-03; `\| **Migrations** \| ... \| 52 sequential migrations building full schema \|` → `62 sequential migrations`; new migration-catalog row for `062_phase61_address_validation.sql` documenting the 6 new columns on appointments + inquiries (with CHECK constraint enum), the gmaps_validate_events sibling table (RLS + indexes), the book_appointment_atomic 17-arg RPC overload, and the record_call_outcome 14-arg RPC overload (with the Plan-01 deviation note that ground-truth was 8-arg pre-overload, not 5-arg as in original CONTEXT). |
| `.claude/skills/integrations-jobber-xero/SKILL.md` | `**Last updated**` bumped 2026-04-20 → 2026-05-03 with Phase 61 callout; new `## Phase 61 cross-link — Voco-normalized address shape` section inserted before `## Related skills` showing the D-D1 9-key named-key shape (street_number / route / subpremise / locality / admin_area_level_1 / admin_area_level_2 / postal_code / country / country_code). Notes that Phase 62 Jobber write-side will consume this shape and that `livekit-agent/src/integrations/google_maps.py::map_components` is the source of truth. |
| `CLAUDE.md` | `**all 58 DB migrations with every table definition**` → `**all 62 DB migrations with every table definition**`; "The 58 migrations are in supabase/migrations/" → "The 62 migrations are in supabase/migrations/". Key-tables list refreshed: legacy `leads`, `lead_calls` removed (Phase 59 dropped these via migration 061); Phase 59 model added (`customers`, `jobs`, `inquiries`, `customer_calls`, `job_calls`, `customer_merge_audit`); Phase 61 telemetry table added (`gmaps_validate_events`). |

**Verification grep checks (all pass):**

```
$ grep -q "Phase 61" .claude/skills/voice-call-architecture/SKILL.md && echo ok        # ok
$ grep -q "062_phase61_address_validation" .claude/skills/auth-database-multitenancy/SKILL.md && echo ok  # ok
$ grep -q "address_components" .claude/skills/integrations-jobber-xero/SKILL.md && echo ok  # ok
$ grep -q "62 DB migrations" CLAUDE.md && echo ok                                       # ok
$ ! grep -q "58 DB migrations" CLAUDE.md && echo ok                                     # ok
```

### Task 3 — BLOCKING human UAT PAUSED AT CHECKPOINT

Cannot be automated (real phone calls + Twilio + Gemini Live + Google Maps API). User must place 4 UAT calls per the plan's `<how-to-verify>` block:

1. **Call 1 — confirmed (D-B3 confirmed branch):** known-good full address; agent should book + read back the normalized form with confidence; Supabase appointments row should show `address_validation_verdict=confirmed` + populated `formatted_address`.
2. **Call 2 — confirmed_with_changes:** address with deliberate misspelling OR SG HDB address without unit number; agent should read back corrected form AND explicitly invite confirmation; Supabase row verdict=`confirmed_with_changes`.
3. **Call 3 — unconfirmed (D-E3 anti-hallucination test):** gibberish address ("123 Made Up Street, Nowhere City"); agent must read back what caller said (NOT a Google version) and MUST NOT use any of the 6 prohibited phrases; Supabase verdict=`unconfirmed`; service_address NOT overwritten.
4. **Call 4 — Spanish locale:** Spanish caller from start; agent responds in Spanish; ES address-validation rule applies (no `validado`/`verificado` claims unless verdict supports); Supabase row landed correctly.

Plus Sentry check (no events on `verdict=unconfirmed`; one event surfaces if env var set to garbage) and `gmaps_validate_events` row check.

**Pre-requisite for UAT:** `GOOGLE_MAPS_API_KEY` must be set on Railway (D-G3 user-action gate). If not yet set, user reports "blocked: env var pending" and we resolve D-G3 before re-running.

## Deviations from Plan

### Auto-fixed (Rule 3 — sibling-only commits, established post-`b6a385f` pattern)

**1. Code commits land on sibling repo only**

- **Found during:** Task 1 RED phase (when about to first write the new test files).
- **Issue:** Plan 04 PLAN.md `<dual_repo_note>` directs the executor to ship code files to BOTH `livekit-agent/` (mirror inside homeservice_agent) AND `C:/Users/leheh/.Projects/livekit-agent/` (sibling repo).
- **Why stale:** Established Phase 61 pattern (Plans 02 + 03 both adopted this override per their Deviation #1) — homeservice_agent commit `b6a385f` (2026-04-22) deleted the mirror because the dual-tree pattern caused Phase 59 Plan 05 changes to land on the monorepo scaffold but NOT on the deployable sibling/Railway. Plans 02 + 03 SUMMARYs both document the override; Plan 04 follows the same pattern.
- **Fix:** All 5 sibling-side files (prompt.py, book_appointment.py, capture_lead.py, 2 new test files) committed to sibling repo only. Worktree carries only the SKILL.md updates + CLAUDE.md + this SUMMARY.
- **Commits:**
  - Sibling repo `f5a0f3d` (Task 1 RED — 2 new test files)
  - Sibling repo `590669f` (Task 1 GREEN — prompt.py + 2 tool description rewrites)
  - Worktree `5930960` (Task 2 — 3 SKILL.md + CLAUDE.md)

### Auto-fixed (Rule 2 — added missing critical functionality)

**2. CLAUDE.md key-table list updated beyond the plan's 58→62 substitution**

- **Found during:** Task 2 Step 2.4, while reading CLAUDE.md.
- **Issue:** CLAUDE.md key-table list claimed `leads` and `lead_calls` exist as key tables. Phase 59 migration 061 (`061_drop_legacy_leads.sql`) dropped both tables; the Phase 59 model uses `customers`, `jobs`, `inquiries`, `customer_calls`, `job_calls`, and `customer_merge_audit`. Plan 04 only specified the migration count substitution but not the key-table list refresh.
- **Why Rule 2:** Leaving stale `leads`/`lead_calls` claims in CLAUDE.md is a correctness defect — every future skill-loading session reads this and gets a wrong mental model of the schema. The plan's Skills-update mandate covers this surface.
- **Fix:** Replaced legacy entries with Phase 59 model + added `gmaps_validate_events` (Phase 61 telemetry table). Mirrors the exact phase realities documented in the auth-database-multitenancy migration catalog.
- **Files affected:** `CLAUDE.md`
- **Commit:** `5930960` (folded into Task 2 commit; no separate fix commit needed).

### Auto-fixed (Rule 2 — bumped pre-Plan-04-stale auth-database header counts)

**3. auth-database-multitenancy `description:` field 61 → 62 + 'Migrations | 52 sequential' → 62**

- **Found during:** Task 2 Step 2.2.
- **Issue:** Plan 04 PLAN.md only mentioned updating CLAUDE.md's "58 migrations" claim, but auth-database-multitenancy/SKILL.md ALSO contained two migration-count claims that were stale (description field said `all 61 migrations` — pre-Phase-61; Architecture Overview table claimed `52 sequential migrations` — frozen since Phase 50 era).
- **Why Rule 2:** Same correctness rationale as deviation #2 — leaving the skill claiming 52 or 61 migrations when 62 is on disk is a mental-model drift defect.
- **Fix:** Both bumped to 62 with Phase 61 callout in description.
- **Files affected:** `.claude/skills/auth-database-multitenancy/SKILL.md`
- **Commit:** `5930960`

### No other deviations

The implementation followed Plan 04's `<action>` blocks for both completed tasks precisely. Section assembly position, prompt body language (EN+ES), tool-description outcome-framing, SKILL.md additive structure, and CLAUDE.md count substitution all match the plan's literal spec.

## Auth gates / human-action

**Task 3 — BLOCKING human UAT (NOT executable in code):**

The 4-call UAT protocol cannot run from this executor. User action required:
1. Verify `GOOGLE_MAPS_API_KEY` is set on Railway (D-G3 — pre-requisite from Phase 61 PROJECT plan).
2. Verify the latest livekit-agent commits (Plans 02 + 03 + Plan 04 GREEN `590669f`) are deployed on Railway (auto-deploy on push to main typically).
3. Place 4 UAT calls per the plan's `<how-to-verify>` block.
4. Run the Supabase verification queries after each call.
5. Report results in the resume signal: number of calls, verdict per call, prohibited-phrase audit, Sentry pages, gmaps_validate_events row counts.

The executor checkpoint protocol mandates STOP here. Auto-mode is false in `.planning/config.json` so no auto-approve fires.

## Threat surface scan

No new threat surface beyond the plan's `<threat_model>` register (T-61-20 through T-61-24). No new endpoints, no new auth paths, no new file-access patterns. The CRITICAL RULE block crosses the static-prompt → Gemini boundary documented in T-61-20; presence + position + prohibited-phrase enumeration are now CI-enforced via `tests/test_prompt_address_validation_rule.py` (mitigates T-61-20).

## Self-Check: PASSED

Verified the following exist on disk:

- `C:/Users/leheh/.Projects/livekit-agent/src/prompt.py` — FOUND, contains `_build_address_validation_section`, both `ADDRESS VALIDATION — CRITICAL RULE` (EN) and `VALIDACIÓN DE DIRECCIÓN — REGLA CRÍTICA` (ES) headers, and `verdict=validated`/`verdict=validated_with_corrections` tokens in both locales.
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/book_appointment.py` — FOUND, description contains "validated", "address", and references the verdict-driven tool return ("confirmed, corrected, or could not be verified").
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/capture_lead.py` — FOUND, symmetric description shape.
- `C:/Users/leheh/.Projects/livekit-agent/tests/test_prompt_address_validation_rule.py` — FOUND, 10 tests collected, 10 GREEN.
- `C:/Users/leheh/.Projects/livekit-agent/tests/test_tool_descriptions_validation_precondition.py` — FOUND, 4 tests collected, 4 GREEN.
- `.claude/skills/voice-call-architecture/SKILL.md` — FOUND, contains "Phase 61" + "_build_address_validation_section".
- `.claude/skills/auth-database-multitenancy/SKILL.md` — FOUND, contains "062_phase61_address_validation" + "62 sequential migrations" + "all 62 migrations".
- `.claude/skills/integrations-jobber-xero/SKILL.md` — FOUND, contains "Phase 61 cross-link" + "address_components" + the 9-key shape.
- `CLAUDE.md` — FOUND, contains "62 DB migrations" + does NOT contain "58 DB migrations".
- Sibling commits `f5a0f3d` (RED) + `590669f` (GREEN) — FOUND in sibling `git log --oneline`.
- Worktree commit `5930960` (Task 2) — FOUND in worktree `git log --oneline`.

Test invariants:
- `pytest tests/test_prompt_address_validation_rule.py tests/test_tool_descriptions_validation_precondition.py -x` — 14/14 GREEN.
- `pytest tests/test_no_generate_reply_in_src.py -x` — 1/1 GREEN (Phase 63.1 regression guard intact).
- 7 pre-existing prompt-test failures + 1 timezone failure pre-date Plan 04 (verified via stash-pop test); documented in `61 deferred-items.md`; out of scope per SCOPE BOUNDARY.

## Status: PAUSED at Task 3 checkpoint

- **Tasks 1 + 2:** ✅ COMPLETE
- **Task 3 (BLOCKING human UAT):** ⛔ AWAITING user — 4 UAT calls + Supabase verification + resume signal.

The orchestrator owns continuation. When the user reports back via resume signal, a fresh executor agent should be spawned to:
1. Read this SUMMARY.
2. Confirm UAT outcome (approved / iteration needed / env var pending).
3. If approved: Phase 61 closes; final SUMMARY refresh + STATE.md / ROADMAP.md updates owned by orchestrator.
4. If iteration needed: open a Plan 05 micro-plan with the specific defect and re-run UAT after fix.
