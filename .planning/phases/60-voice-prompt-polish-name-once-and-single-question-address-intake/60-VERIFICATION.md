---
phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake
verified: 2026-04-19T15:00:00Z
status: human_needed
score: 18/18 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Persona 1 — Culturally diverse name + clear address (baseline)"
    expected: "AI captures name silently (no 'Thanks, Jia En' or 'Okay Jia En' before readback); single-question address opener; reads back name+address in one utterance before book_appointment fires; zero vocative name use before readback"
    why_human: "Audio-LLM vocative suppression and temporal ordering across utterance+tool invocation cannot be deterministically asserted in unit tests — requires listening to a live call"
  - test: "Persona 2 — Casual one-breath address (SG-style lead)"
    expected: "AI extracts street/block/unit/area from single utterance; asks exactly one targeted follow-up for missing piece; no three-part walkthrough"
    why_human: "Single-question opener enforcement and follow-up count require live call observation"
  - test: "Persona 3 — Mid-readback correction (US-style lead, two corrections)"
    expected: "AI accepts each correction and re-reads the corrected full name+address; loops at least twice; each re-read contains full line"
    why_human: "Correction loop behavior and re-read completeness require temporal audio observation across multiple AI turns"
  - test: "Persona 4 — Caller invites name use ('you can call me Sam')"
    expected: "AI uses name naturally for rest of call after invitation; readback still fires; no vocative use before invitation"
    why_human: "Subjective naturalness judgment required; invitation detection is outcome-framed (Gemini uses judgment, not keyword match)"
  - test: "Persona 5 — Caller refuses name"
    expected: "AI proceeds without blocking; readback contains only address; book_appointment fires; DB row has caller_name null/empty"
    why_human: "End-to-end no-name path requires live call + Supabase row verification"
  - test: "Persona 6 — Caller declines to book (decline path)"
    expected: "Single-question intake still used; readback of name+address fires before capture_lead; capture_lead fires once"
    why_human: "Behavioral parity on decline path requires live call observation"
  - test: "Persona 7 — Spanish caller"
    expected: "AI switches to Spanish on explicit request; single-question opener in Spanish ('¿Cuál es la dirección donde necesita el servicio?'); readback once in Spanish; all D-01..D-12 rules hold in Spanish; no English drift"
    why_human: "Spanish locale behavior, no-English-drift, and same rule count require a live Spanish-language call on Railway deploy"
  - test: "24-hour Sentry regression check (post-deploy)"
    expected: "Zero new tool_call_cancelled spikes attributable to Phase 60; zero parrot-loop matches (tool return text spoken verbatim by AI)"
    why_human: "Requires 24-hour Railway production observation window using queries from phase-60-sentry-playbook.md"
gaps: []
deferred: []
---

# Phase 60: Voice Prompt Polish — Name-Once + Single-Question Address Intake — Verification Report

**Phase Goal:** Reduce AI voice-agent hallucination and awkward persona behavior by (a) stopping the agent from repeating the caller's name mid-call, (b) replacing the three-part address walkthrough with a single natural question, (c) enforcing a mandatory readback-before-booking with accept-and-re-read correction loop, (d) rewriting every tool return to strict STATE:<code>|DIRECTIVE:<imperative> format (no parrot-loop surface), (e) mirroring the three new blocks in Spanish idiomatically behind a user-review gate, and (f) keeping SKILL.md in sync with shipped code.
**Verified:** 2026-04-19T15:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

All 18 must-haves pass automated code verification. Live-call UAT (Personas 1-7) and a 24-hour Sentry regression window are required before the phase can be marked fully complete — these are tracked in the `human_verification` frontmatter above.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AI never addresses caller by name mid-call (D-01..D-05) — NAME USE DURING THE CALL block present | VERIFIED | `grep -c "NAME USE DURING THE CALL" src/prompt.py` = 1; "Do not address the caller by name" present; sole exception for booking readback documented |
| 2 | AI opens address intake with single natural question "What's the address where you need the service?" (D-06..D-08) | VERIFIED | `grep -c "What's the address where you need the service" src/prompt.py` = 1; SERVICE ADDRESS block verified at line 295+ in prompt.py |
| 3 | One targeted follow-up per missing address piece — never a field list (D-07..D-08) | VERIFIED | "Never run a mechanical walkthrough" / "Loop one piece at a time" / outcome-framed minimum capture ("Capture enough for us to find the place") present in SERVICE ADDRESS block |
| 4 | BEFORE BOOKING — READBACK block fires before book_appointment (D-02, D-09, D-10) | VERIFIED | `grep -c "BEFORE BOOKING.*READBACK" src/prompt.py` = 1; block reads back name+address in one utterance; accept-and-re-read loop; no-name address-only path |
| 5 | Accept-and-re-read correction loop until caller stops correcting (D-09, D-10) | VERIFIED | "the caller's correction is ALWAYS correct — see CORRECTIONS above" present in READBACK block; loop instruction explicit |
| 6 | No-name path completes booking without blocking (D-04) | VERIFIED | "If no name was captured, read back only the address. Do not pause to ask for a name." in READBACK block; "Booking is never blocked by a missing name." in NAME USE block |
| 7 | Anti-hallucination rules (OUTCOME WORDS, TOOL NARRATION) remain at top of assembled prompt (D-15) | VERIFIED | OUTCOME WORDS at source line 79; TOOL NARRATION at source line 114 — both in sections 4+5 of the assembly list, well within first 30 non-blank assembled lines |
| 8 | Zero VAD-redundant guidance in prompt.py (D-15) | VERIFIED | No matches for "let them finish", "don't interrupt", "do not interrupt", "wait for them to finish"; the one "wait for the result" match (line 106) refers to a tool call returning, not caller turn-taking |
| 9 | Every tool return uses STATE:<code>|DIRECTIVE:<imperative> format — no speakable English (D-16) | VERIFIED | book_appointment: 6 STATE, 6 DIRECTIVE; capture_lead: 3/3; transfer_call: 3/3; check_availability: 10/10; check_caller_history: 5/5 — all above plan minimums |
| 10 | capture_lead description mirrors single-question address rule + readback parity (D-11) | VERIFIED | "single-question address rule" present in capture_lead.py (1 match); "readback" present (1 match) |
| 11 | book_appointment description reinforces readback-before-call precondition (D-12) | VERIFIED | "readback" (2 matches) and "do not read it aloud" (1 match) in book_appointment.py description |
| 12 | Phase 46 booking-reconciliation stamps preserved (D-12 scope constraint) | VERIFIED | `_booking_succeeded` (1 match) and `_booked_appointment_id` (1 match) in book_appointment.py |
| 13 | Phase 30 transfer state code names preserved in transfer_call.py (D-16 scope constraint) | VERIFIED | `STATE:transfer_initiated`, `STATE:transfer_failed`, `STATE:transfer_unavailable` — all 3 present |
| 14 | check_availability: no-fabrication + no-list-read-out directives preserved | VERIFIED | "do not read the full slots list out loud" (2 matches); "do not fabricate times" (3 matches) |
| 15 | check_caller_history: silent-context discipline preserved | VERIFIED | "do not recite" (5 matches) across directives |
| 16 | end_call.py UNCHANGED — no STATE/DIRECTIVE added (per D-16 decision) | VERIFIED | grep for STATE:/DIRECTIVE: in end_call.py = 0 matches |
| 17 | Spanish render (locale='es') mirrors all three Phase 60 blocks idiomatically (D-13, D-14) | VERIFIED | USO DEL NOMBRE DURANTE LA LLAMADA (1), "No se dirija al cliente por su nombre" (1), "¿Cuál es la dirección donde necesita el servicio?" (1), "Lea de nuevo el nombre" (1), "corrección del cliente SIEMPRE es correcta" (1), "Capture lo suficiente" (1) — all in prompt.py under locale='es' conditionals; `_build_info_gathering_section` and `_build_booking_section` both accept `locale: str = "en"` parameter; build_system_prompt passes locale through to both |
| 18 | SKILL.md synced with shipped Phase 60 behavior (CLAUDE.md "Keep skills in sync" rule) | VERIFIED | Phase 60 (12 mentions); name vocative (2); single-question (4); STATE: (10); DIRECTIVE: (7); "What's the address where you need the service" (4); BEFORE BOOKING (3); state codes union ≥5 (9 matches); Phase 46 entry preserved verbatim (1 match) |

**Score:** 18/18 truths verified

---

### Deferred Items

None.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `/Users/leroyngzz/Projects/livekit_agent/src/prompt.py` | NAME USE / SERVICE ADDRESS / BEFORE BOOKING READBACK blocks (EN + ES); locale='es' conditionals | VERIFIED | All 6 key phrases confirmed present; both builder functions accept locale parameter |
| `/Users/leroyngzz/Projects/livekit_agent/src/tools/book_appointment.py` | STATE+DIRECTIVE all branches; readback precondition in description; Phase 46 stamps | VERIFIED | 6 STATE, 6 DIRECTIVE, _booking_succeeded, _booked_appointment_id all confirmed |
| `/Users/leroyngzz/Projects/livekit_agent/src/tools/capture_lead.py` | STATE+DIRECTIVE; single-question rule + readback in description | VERIFIED | 3 STATE, 3 DIRECTIVE; description has both required phrases |
| `/Users/leroyngzz/Projects/livekit_agent/src/tools/transfer_call.py` | STATE+DIRECTIVE; Phase 30 state code names preserved | VERIFIED | 3 STATE, 3 DIRECTIVE; all 3 Phase 30 state codes present |
| `/Users/leroyngzz/Projects/livekit_agent/src/tools/check_availability.py` | STATE+DIRECTIVE; no-fabrication + no-list-read-out directives | VERIFIED | 10 STATE, 10 DIRECTIVE; 2 no-list-read-out, 3 no-fabricate-times |
| `/Users/leroyngzz/Projects/livekit_agent/src/tools/check_caller_history.py` | STATE+DIRECTIVE; silent-context discipline | VERIFIED | 5 STATE, 5 DIRECTIVE; 5 "do not recite" instances |
| `/Users/leroyngzz/Projects/livekit_agent/src/tools/end_call.py` | UNCHANGED — no STATE/DIRECTIVE | VERIFIED | 0 STATE/DIRECTIVE matches — file untouched |
| `/Users/leroyngzz/Projects/livekit_agent/docs/uat/phase-60-personas.md` | 7 UAT personas covering D-01..D-14 | VERIFIED | `grep -c "^## Persona"` = 7 |
| `/Users/leroyngzz/Projects/livekit_agent/docs/uat/phase-60-sentry-playbook.md` | tool_call_cancelled + parrot-loop queries | VERIFIED | tool_call_cancelled (4 matches), parrot (1 match) |
| `/Users/leroyngzz/Projects/homeservice_agent/.claude/skills/voice-call-architecture/SKILL.md` | Phase 60 Last-updated entry; §4 items 8+10 updated; §5 tool inventory; D-01..D-10 subsection; Phase 46 preserved | VERIFIED | All 8 acceptance-criteria grep checks pass; §8 and §10 section text updated; new Phase 60 subsection at line 376; full Phase 46 entry preserved |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `_build_info_gathering_section(prompt.py)` | NAME USE DURING THE CALL block | locale='es' conditional + direct English embedding | VERIFIED | "NAME USE DURING THE CALL" at source line 295+; English path unconditional; Spanish path at `if locale == "es"` block |
| `_build_info_gathering_section(prompt.py)` | SERVICE ADDRESS single-question block | direct embedding (English) + locale='es' conditional (Spanish) | VERIFIED | "What's the address where you need the service?" = 1 match; Spanish "¿Cuál es la dirección donde necesita el servicio?" = 1 match |
| `_build_booking_section(prompt.py)` | BEFORE BOOKING — READBACK block | ternary conditional `if locale == "es" else` at line 469 | VERIFIED | English READBACK block confirmed; Spanish "Lea de nuevo el nombre" + "hasta que deje de corregir" loop confirmed wired |
| `build_system_prompt(locale)` | `_build_info_gathering_section` + `_build_booking_section` | passes `locale` positional arg to both at lines 600+602 | VERIFIED | Both call sites pass locale through |
| Gemini model | tool return string | model reads return as context for next utterance | VERIFIED | All 5 tool files: `return.*STATE:.*DIRECTIVE:` pattern confirmed; every return starts STATE:, none start with speakable English |
| SKILL.md | shipped prompt.py + tools | documented rules match actual code strings | VERIFIED | STATE:booking_succeeded present in both SKILL.md (1) and book_appointment.py (2); all tool-section state codes copied from actual files |

---

### Data-Flow Trace (Level 4)

Phase 60 is a prompt-engineering and string-rewriting phase — no new data models, no new rendering components. The changes are:
- Prompt text blocks (static string literals in prompt.py) that flow into the Gemini system prompt via build_system_prompt — no data source to trace; the content IS the output
- Tool return strings (static string templates in tools/*.py) — machine-facing directives to Gemini; no data pipeline beyond direct return values

Level 4 data-flow trace is not applicable for prompt/string-only changes.

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| prompt.py Python syntax validity | SUMMARY confirms `python3 -c "import ast; ast.parse(open('src/prompt.py').read())"` passed | OK per 60-03-SUMMARY.md | PASS |
| OUTCOME WORDS + TOOL NARRATION in early prompt assembly | Source lines 79 + 114 — sections 4+5 in 13-section assembly list | Confirmed by grep | PASS |
| All 5 tool return patterns are machine-facing (no speakable English starts) | Grep for natural-English return starters returned 0 matches per SUMMARY | 0 speakable leftovers per 60-02-SUMMARY self-check | PASS |
| Pytest suite | Cannot run locally (macOS Python 3.9 vs livekit_agent's Python 3.11+ requirement); Railway CI runs on push | Documented in all 3 SUMMARYs; Plan 01 Task 0 confirmed NO_MATCHES on return-string test inventory (safe for D-16 rewrite) | SKIP (Railway CI only) |

---

### Requirements Coverage

Phase 60 is decision-driven (requirements: [] in all plan frontmatter). Decisions D-01..D-16 are the governing contract. No REQUIREMENTS.md row maps to Phase 60.

| Decision | Plans | Description | Status |
|----------|-------|-------------|--------|
| D-01..D-05 | 60-01 | Name-vocative suppression — capture silently, no mid-call use, single readback exception, caller-invite override, no-name path | SATISFIED |
| D-06..D-08 | 60-01 | Single-question address intake — natural opener, one targeted follow-up, outcome-framed minimum capture | SATISFIED |
| D-02, D-09, D-10 | 60-01 | BEFORE BOOKING — READBACK block — one utterance, correction loop, no-name path | SATISFIED |
| D-11 | 60-02 | capture_lead description parity — same single-question + readback rules as booking path | SATISFIED |
| D-12 | 60-02 | book_appointment description — readback-before-call CRITICAL PRECONDITION explicit | SATISFIED |
| D-13, D-14 | 60-03 | Spanish mirror of all three blocks — user-reviewed (usted register); user signaled approved first pass | SATISFIED |
| D-15 | 60-01 | Light structural audit — anti-hallucination rules in first 30 assembled lines; no VAD-redundant lines; persona-distinctness check passed | SATISFIED |
| D-16 | 60-02 | Universal STATE+DIRECTIVE tool-return contract across all 5 tools | SATISFIED |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/prompt.py` | 106 | "wait for the result to arrive" | Info | This is NOT a VAD-redundant phrase — it refers to waiting for a tool call to return, not waiting for the caller to finish speaking. It is part of the TOOL NARRATION discipline. Not a blocker. |
| `src/prompt.py` | 464 | `"hasta que deje de corregir"` (Spanish) | Info | Plan 03 SUMMARY correctly identified this as a false positive for the VAD-redundant Spanish phrase regex `deje (que|de)`. It is a CORRECTIONS-loop terminator ("until they stop correcting"), not a caller-turn-taking wait instruction. Not a blocker. |

No blocker anti-patterns. No stubs. No orphaned artifacts.

---

### Human Verification Required

**8 items require human testing. All are behavioral/UAT items that cannot be verified by code inspection alone.**

#### 1. Persona 1 — Culturally diverse name + clear address (D-01, D-02, D-06)

**Test:** Call the Railway-deployed agent with a culturally diverse name (e.g., "Hi, my name is Jia En Tan. I need a plumber at 42 Lornie Road, Singapore 298107.")
**Expected:** AI captures name silently (no "Thanks, Jia En" or "Okay Jia En" before readback); asks address with single natural question if needed; reads back "Jia En Tan, 42 Lornie Road, Singapore 298107" in ONE utterance before book_appointment fires; zero vocative name use before readback
**Why human:** Audio-LLM vocative suppression and temporal ordering (utterance precedes tool invocation) require listening to live call; not deterministically assertable in unit tests

#### 2. Persona 2 — Casual one-breath address (D-06, D-07)

**Test:** Give address in one breath: "Yeah it's Jurong West, block 6, unit 12-345."
**Expected:** AI extracts street/block/unit/area from single utterance; asks exactly ONE targeted follow-up for the one missing piece (e.g., postal code); no three-part walkthrough enumeration
**Why human:** Single-question enforcement and follow-up count require live call observation

#### 3. Persona 3 — Two mid-readback corrections (D-05, D-09, D-10)

**Test:** Name "Sam Johnson", address "123 Main Street, Austin, Texas 78701." During readback, correct: "no, it's 125, not 123." Then correct again: "and it's spelled with an 'h' — Johnson with an h."
**Expected:** AI accepts each correction, re-reads the full corrected name+address after each, loops through both corrections; each re-read contains the full line
**Why human:** Correction loop temporal behavior across multiple AI turns requires live call observation

#### 4. Persona 4 — Caller invites name use (D-03)

**Test:** Early in the call say: "You can call me Sam."
**Expected:** AI uses name naturally for rest of call (not every turn); readback still fires before booking; no vocative use before the invitation
**Why human:** Subjective naturalness judgment required; invitation detection is outcome-framed (Gemini uses judgment, not keyword match)

#### 5. Persona 5 — Caller refuses name (D-04)

**Test:** When asked for name, respond: "I'd rather not give a name."
**Expected:** AI proceeds without blocking; readback contains only the address (no name portion); book_appointment fires; Supabase `appointments.caller_name` row is null/empty
**Why human:** End-to-end no-name path requires live call + Supabase row verification

#### 6. Persona 6 — Caller declines to book (D-11, D-12 decline path)

**Test:** Normal name + address intake, then: "Actually, I just want someone to call me back later."
**Expected:** AI still uses single-question address intake; reads back name + address once before capture_lead fires; capture_lead fires once
**Why human:** Behavioral parity on decline path requires live call observation and tool-invocation confirmation

#### 7. Persona 7 — Spanish caller (D-13)

**Test:** Call entirely in Spanish: "Hola, me llamo María García. Necesito un plomero en Calle Mayor 45, Madrid 28013."
**Expected:** AI switches to Spanish on explicit request; single-question opener in Spanish ("¿Cuál es la dirección donde necesita el servicio?"); readback once in Spanish; all D-01..D-12 rules hold in Spanish; no English drift
**Why human:** Spanish locale behavior, English-drift detection, and same-rule-count verification require a live Spanish-language call on the Railway deploy

#### 8. 24-hour Sentry regression check (post-deploy)

**Test:** 24 hours after Railway redeploy, run both queries from `livekit_agent/docs/uat/phase-60-sentry-playbook.md`:
- Query 1: `tags.component:voice-agent AND message:"tool_call_cancelled" AND timestamp:[now-24h TO now]` — expected: baseline (zero-to-few); any new spike means a VAD-redundant prompt line crept in
- Query 2: `tags.component:voice-agent AND (message:"Booking confirmed for" OR message:"slot is available" OR message:"earliest at" OR message:"lead captured") AND timestamp:[now-24h TO now]` — expected: zero matches (D-16 held)
**Why human:** Requires 24-hour production observation window; automated checks cannot simulate the full call + Sentry pipeline

---

### Gaps Summary

No gaps. All 18 must-haves from Plans 01, 02, and 03 verified in the actual codebase. Phase can proceed to live-call UAT.

The pre-existing Phase 30 Spanish structural gap (URGENCY, SCHEDULING, AVAILABILITY RULES, HANDLING THE RESULT, AFTER BOOKING remain English-only for locale='es') is a documented, intentional non-fix per Phase 60 Plan 03 decision. It is not a Phase 60 gap.

---

_Verified: 2026-04-19T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
