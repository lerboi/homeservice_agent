---
type: system
system: Voice Agent
status: current
description: "System Prompt (Phase 60 restructure). Covers: Tool return format (Phase 60 D-16); Single-English-prompt policy (2026-06-11 — replaces the dual-prompt/D7 locale-parity policy)"
source: .claude/skills/voice-call-architecture/SKILL.md § 4. System Prompt (Phase 60 restructure)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# System Prompt (Phase 60 restructure)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

**File**: `src/prompt.py`

`build_system_prompt(locale, *, business_name, onboarding_complete,
tone_preset, intake_questions, country, working_hours, tenant_timezone,
customer_context=None, caller_history=None)`.

**Cache-aware layout (2026-09-01):** every tenant-stable section comes
first; the two per-caller blocks (caller history, customer context) are
appended AFTER Transfer, directly ahead of the FINAL recap; `agent.py`
appends `"Today is …"` after the function returns. So for a given tenant the
prompt prefix is byte-identical across calls and OpenAI prompt caching
serves it (see §1 step 11 for `prompt_cache_key` + the greeting-time warm
request). Nothing time-dependent is rendered inside `build_system_prompt`.
Locked by `tests/test_prompt_cache_prefix.py` — **do not move per-caller
data back above the stable sections.**

Sections (order):

1. **Identity** — role, tone, conciseness.
2. **Voice Behavior** — **conciseness-first since 2026-06-10**: leads with
   "Speak in one or two short sentences per turn, then stop and let the
   caller talk. Ask exactly one question per turn. The booking confirmation
   readback is the only turn that may run longer." The old "natural
   back-and-forth matters more than efficiency" opener was REMOVED (it
   licensed long turns); acknowledgments bounded to "a few words at most";
   the slow-on-readbacks guidance preserved ("slower there, never wordier"
   — pace, not length). English-only since the 2026-06-11 single-prompt
   collapse. **2026-09-04 P1.7 (acknowledge + act):** the "After the caller
   answers" paragraph now says act — go straight to the next step or lead
   with at most two words ("Okay." "Sure.") — and NEVER restate what the
   caller just said (only a name, an address, a phone number, or a booking
   time is ever read back), with a WRONG/RIGHT pair ("Got it, your toilet
   needs fixing." vs "Okay — what's the address?") and "never start two
   turns in a row the same way" (76% of agent turns were questions, most
   opened by paraphrasing the caller). A matching one-line brevity recap is item 4
   of FINAL — NON-NEGOTIABLES (recency position; the prompt still ends
   with the test-pinned "Don't interrogate the caller about the
   situation." line). TOOL NARRATION's filler target also tightened from
   "~3 seconds … longer, warmer filler" to ONE warm sentence (~2s) — the
   filler remains MANDATORY (covers tool latency; silence is never
   licensed). **2026-09-04 P1.6 (rotating filler bank):** rules 7 ("never
   say the same filler twice in one call — rotate, and change the shape")
   and 8 (a second call of the same tool in one loop takes a short bridge on
   the acknowledgement — "Okay, seven six eight — trying that." — instead
   of a fresh filler) were added; the example bank is 3–4 differently
   shaped phrases per tool (Let me… / I'll… / Hang on… / present-participle)
   with the "one moment" tail dropped, and the "second-worst … worst"
   closer is gone. The literal "Let me just check that address real quick."
   (spoken 7× across 4 real calls) no longer appears anywhere — the ADDRESS
   VALIDATION opener says "a fresh one — see TOOL NARRATION" and the five
   tool descriptions point at the bank instead of quoting a phrase
   (GPT-4.1 copies the literal nearest the decision point).
   `tests/test_prompt_tool_narration.py` pins: no example phrase twice,
   ≤2 examples with a "one moment"/"one sec" tail, no `'Let me` literal in
   any tool description. **2026-06-12 (P4):** carries the
   register contract — banned stock phrases ("Thank you for that
   information", "How may I assist you", announced transitions, etc.),
   contractions required, hard never-two-questions rule with the Call-B
   counter-example — and a SAYING NUMBERS AND DATES OUT LOUD block
   (postal/phone/unit digits spelled out in groups, times as people say
   them, dates without the year, never announce today's date; the LLM's
   text feeds ElevenLabs verbatim, so these rules directly control TTS
   rendering).
3. **Corrections** — top-level section: caller correction ALWAYS replaces
   old value; never read back incorrect data. Concrete example included.
   **2026-06-12 (P5):** ends with a HEARING THROUGH THE PHONE block — a
   near-soundalike of already-confirmed data is a mishearing (never adopt
   or parrot it back, e.g. Call D's "Lucky Kenberg Drive"); never read back
   implausible strings; after two unclear repeats switch to a best-guess
   yes/no question; names get spelled.
4. **Business Hours** — computed from `working_hours` JSON, grouped
   (e.g., "Mon-Fri: 9:00 AM - 5:00 PM"). Includes lunch breaks. Empty if
   `working_hours` is None.
5. **Opening Line** — greeting + recording disclosure.
6. **Language** (2026-06-11 single-prompt collapse — the ONE place
   `locale` changes the prompt) — supported languages are exactly
   English and Spanish (matches the Deepgram nova-3 `language="multi"`
   EN+ES pin). The tenant-default-language line flips on `locale`:
   "Default to English on every call." vs "This business operates in
   Spanish — open in Spanish and default to Spanish on every call."
   Switch only on explicit caller request, switch back the same way,
   continue from where you left off. Carries a SPEAKING SPANISH —
   DELIVERY GUIDE in English (usted register; Spanish times/dates;
   "código postal" with the caller regardless of market; digit-by-digit
   phone readback; Spanish fillers; any-language applicability of the
   reserved/prohibited-word rules — incl. the Spanish address-validation
   forms "validado/validada", "verificado/verificada", "coincide con
   nuestros registros"). Unclear speech treated as connection issue,
   not language barrier. Phase 62 ANTI-HALLUCINATION preserved: when
   transcription appears in an unsupported language (German / French /
   Italian / etc.), treat it as an STT error of English or Spanish
   audio — do NOT respond in the perceived language and do NOT tell the
   caller "I only speak English" (both reveal the STT failure).
   Substitute a connection-issue framing: "Sorry, the audio cut out for
   a moment — could you say that again?" Real language switches require
   an explicit caller phrase like "Can we speak in Spanish?" /
   "¿Podemos hablar en inglés?" — foreign text in transcript is NOT
   consent. Call AJ_gpRzniyNoJBd (2026-05-07) is the regression source.
7. **Repeat Caller** — empty (never reveal prior history; silent context).
8. **Customer Context (Phase 55/56)** — **position MOVED 2026-09-01**: this
   block and the Caller History block (`_build_caller_history_section`,
   Phase 62 pre-session inject, `CALLER HISTORY (silent context):`) now
   render after Transfer, just before the FINAL recap (cache-aware layout
   above); the rest of this list keeps its relative order.
   `_build_customer_account_section`
   inserts a STATE+DIRECTIVE block if `customer_context` non-null.
   Field shape from the Xero+Jobber merge; DIRECTIVE forbids volunteering
   balance/invoices. Omitted entirely when None. See
   `integrations-jobber-xero` skill.
9. **Info Gathering (Phase 60 D-01..D-08)** — outcome-framed. Three needed
   before scheduling: issue, name, complete address. Order not forced.
   - NAME USE DURING THE CALL: capture silently; no name vocative
     mid-call. The booking readback is the SOLE on-air name moment.
     Phase 62 hardened the rule with an explicit forbidden-patterns
     enumeration ("Thanks, {name}", "Got it, {name}", "{name}, I have…",
     etc.) plus an outcome-based acknowledgment rule (acknowledgment
     must not contain the caller's name; tone-flexible). Call
     AJ_gpRzniyNoJBd (2026-05-07) caught Gemini violating the prior
     less-explicit phrasing. Caller-invited override ("you can call me X")
     honored. **2026-09-04 P1.7:** the acknowledgment bullet is now "two
     words at most and must not contain the caller's name" (the
     "confirm receipt" framing is gone).
   - SERVICE ADDRESS: single-question opener "What's the address where
     you need the service?" — replaces the old three-part walkthrough.
     One targeted follow-up per missing piece; never enumerate fields.
     **2026-09-04 P1.4:** `_build_info_gathering_section(t, postal_label,
     locale, country="US")` — for `country == "SG"` ONLY (country-gated,
     never locale-gated) an extra bullet: "In Singapore the postal code pins
     down the building — if the caller gives it, call validate_address
     right away even if the street name was unclear; then ask only for the
     unit number." Pinned by `tests/test_prompt_info_gathering.py`.
   - URGENCY: silent classification; never ask caller to rate; never use
     "emergency/urgent/routine" out loud.
10. **Intake Questions** — trade-specific, fetched pre-session and injected
    into the system prompt (Phase 63.1 moved this off `generate_reply`; the
    text arrives in the initial `build_system_prompt(intake_questions=...)`).
    **2026-06-12 (P3):** reframed as technician-prep nice-to-haves that must
    never delay scheduling — at most ONE asked before the slot is locked,
    the rest after booking confirmation; skip any answered in substance;
    skip all if the caller is rushed; rephrased, never read like a form
    (evidence: Call D's "Let me just skip the whatever", Call A re-asking
    an answered question). The services fetch in agent.py now also selects
    `name` (feeds P8.2 STT keyterms).
11. **Booking Protocol (Phase 60 D-02/D-09/D-10; AVAILABILITY rewritten 2026-06-12 P1)**:
    - SCHEDULING: **rewritten 2026-09-04 P1.8** — move to scheduling once
      you have the issue and a confirmed address (get the name on the way,
      never hold booking for it); pick the tool by what the caller gave: a
      day and a time → check_slot now; a day only → check_day now (don't
      ask "what time?" first — offer what it returns); nothing specific →
      next_available_days now. This removed two contradictions that each
      cost a question turn per booking: "only once you have the caller's
      name" (vs NAME USE's "Booking is never blocked by a missing name")
      and "needs both a day and a time … help them decide the other before
      you check" (vs the AVAILABILITY routing). `tests/test_prompt_booking.py`
      pins the new routing text and the absence of the old sentences.
    - AVAILABILITY RULES: every caller-named new date/time requires a fresh
      `check_slot` (or `check_day` / `next_available_days`). **2026-06-12:**
      the agent may OFFER at most 2–3 times taken from a tool return in this
      turn (never recite lists, never invent); every rejection pairs with a
      tool-returned alternative "in the same breath"; a caller-picked offered
      time books directly with its token.
    - READBACK (mandatory, and the ONLY confirmation): name + address-if-
      never-validated in ONE utterance, offer folded in ("…shall I lock that
      in?"); no separate pre-confirm question, no post-yes re-confirm.
      Accept-and-re-read correction loop until caller stops correcting.
      Address-only if no name captured.
    - AFTER BOOKING: confirm day + time ONLY (never re-read the address),
      ask if anything else.
12. **Decline Handling** — only when `onboarding_complete=True`. Judgment-
    based, not a two-strike counter. Silence/topic changes/thinking NOT declines.
13. **Transfer Rules** — 2 triggers only: caller asks for human, or 3
    failed clarifications. Transfer-recovery: on fail, offer callback
    booking or capture lead.
14. **Call Duration** — 9-min wrap-up, 10-min hard max. Goal-oriented
    end: speak goodbye, pause, then `end_call`.

### Tool return format (Phase 60 D-16)

Tool returns use the strict `STATE:<code>|DIRECTIVE:<imperative>` format —
machine-facing, not speakable — across `check_slot`/`check_day`/
`next_available_days`, `capture_lead`, `transfer_call`, and
`check_caller_history`. Every DIRECTIVE ends with "Do not repeat this message
text on-air." `end_call` is untouched (returns a space character). **Exception
(Phase 61):** the `book_appointment` / `capture_lead` *success* path uses a
label form `BOOKED [verdict=...]:` / `LEAD CAPTURED [verdict=...]:` instead of
`STATE:` (see the Phase 61 address-validation section + its brittleness watch).

### Single-English-prompt policy (2026-06-11 — replaces the dual-prompt/D7 locale-parity policy)

The prompt is **one English prompt for every call**. The Phase 60.3 D7
"EN+ES parity" era (every section builder carrying an `if locale == "es"`
branch) is OVER — all ES branches were removed on 2026-06-11 with the
English text preserved byte-identically. The model speaks Spanish at
runtime when the call is in Spanish; it is *instructed* in English.

- `build_system_prompt(locale, ...)` keeps its signature; `locale` drives
  exactly ONE thing — the tenant-default-language line in the LANGUAGE
  section. `tests/test_prompt_locale_collapse.py` locks this structurally:
  en/es assembled prompts must differ in exactly that one line.
- Spanish delivery conventions (usted register, "código postal", Spanish
  reserved/prohibited word forms, Spanish fillers, times/dates/phones)
  live in the LANGUAGE section's SPEAKING SPANISH — DELIVERY GUIDE, in
  English. OUTCOME WORDS carries the Spanish reserved words in its
  "in any language, including Spanish" clause.
- **Do NOT reintroduce `if locale == "es"` branches in section builders.**
  New behavioral rules are written once, in English; if a rule has a
  Spanish-delivery implication, extend the LANGUAGE delivery guide.
- Out of scope for the collapse (still per-locale): the deterministic
  `session.say()` greeting + `max_duration_goodbye` in
  `src/messages/{en,es}.json`, post-call language detection,
  notifications, whisper_message.
- The old "Phase 30 structural gap" note (some blocks English-only under
  the dual-prompt era) is obsolete — everything is English by design now.

---
