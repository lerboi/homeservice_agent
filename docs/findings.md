# Voice Agent Naturalness & Information-Collection Findings

**Date**: 2026-06-11
**Status**: ✅ IMPLEMENTED 2026-06-12 — all eight proposals (P1–P8) are in the livekit-agent working tree (UNCOMMITTED at time of writing). Suite: 441 passed / 1 pre-existing VIP failure. Implementation notes vs. this proposal: the P2 country guard lives in `google_maps.validate_address_with_region_fallback` (`_apply_country_guard`) and downgrades to the existing `unconfirmed` verdict (no DB change needed; the downgrade fires BEFORE the retry decision, so the caller-region retry self-heals the Utah case); P8 is env-gated — `VOCO_PREEMPTIVE_GENERATION` (default ON) and `VOCO_STT_KEYTERMS` (default OFF until a UAT call verifies Deepgram accepts keyterm with language="multi"). P7 SQL is staged in `My Prompts/text2` for manual application (NOT yet run). The `voice-call-architecture` skill has been synced. The section below is preserved as the original proposal record.

---

## 0. TL;DR

Four production call transcripts (June 9–11, all on/around the new Phase 66 cascade pipeline) show the agent collecting the right data in a way that feels like a robotic interview: it argued with a caller to defend a Google-inferred postal code, booked a Singapore job to a **Utah, USA address**, read one address aloud up to 5 times in a single call, trapped a caller in a "name a time → rejected → name another time" guessing game until they hung up, and ran a blocking two-question intake interview that made another caller say *"Let me just schedule it. Let's just skip the whatever."*

Eight proposals (P1–P8) fix this. The two highest-impact are structural: **P1** lets the agent offer 2–3 *tool-returned* times instead of forcing callers to blind-guess (reverses the "never list slot times" design decision while preserving every anti-hallucination invariant), and **P2** makes the caller — not Google — the authority on their own address. The rest are prompt-register and flow changes. All collected data stays exactly the same; only the conversation changes.

---

## 1. Scope & hard constraint

**Goal**: make the AI receptionist converse naturally and collect information efficiently, modeled on the perfect caller experience: *"I called, said what's wrong, gave my address once, picked from a couple of offered times, and was booked in under 3 minutes without ever repeating myself or being interrogated."*

**Hard constraint (user-stated)**: every piece of data currently collected must still be collected — caller name, issue/job type, full service address (street, unit, postal), silent urgency classification, booking slot, intake-question answers, alternate callback phone when offered. Only the *manner* of collection and the conversational style change.

---

## 2. Required reading before implementing

| What | Where | Why |
|---|---|---|
| Architecture skill | `homeservice_agent/.claude/skills/voice-call-architecture/SKILL.md` | Single source of truth for the call system; **must be updated after implementing** (CLAUDE.md rule) |
| System prompt | `livekit-agent/src/prompt.py` (sibling repo `C:/Users/leheh/.Projects/livekit-agent/`, deployed to Railway) | Every prompt proposal below names its `_build_*_section` builder |
| Availability tools | `livekit-agent/src/tools/check_slot.py`, `check_day.py`, `next_available_days.py`, `_availability_lib.py` | P1 changes their return shapes |
| Address tools | `livekit-agent/src/tools/validate_address.py`, `src/integrations/google_maps.py` | P2 changes verdict handling |
| Booking/lead tools | `livekit-agent/src/tools/book_appointment.py`, `capture_lead.py` | P2 directive changes |
| Agent entrypoint | `livekit-agent/src/agent.py` (~L520–570 session construction, ~L378–400 intake fetch, ~L960–1030 greeting) | P8 latency/STT experiments |
| Test suite | `livekit-agent/tests/test_prompt_*.py`, `test_validate_address_tool.py`, `test_book_appointment_validation.py`, `test_capture_lead_validation.py`, `test_google_maps.py`, `test_slot_token_handoff.py`, `test_tool_descriptions_validation_precondition.py`, `test_prompt_locale_collapse.py` | Many pin exact prompt/tool substrings — every wording change must update its pinned test |
| User-memory constraints | `feedback_livekit_prompt_philosophy.md` (outcome-based prompts), `feedback_directive_prompt_silence_deadlock.md` (**never license silence in an info-gathering loop** — Phase 61.1 deadlock lesson) | Prompt-rewrite guardrails that still apply |

**Architecture snapshot (Phase 66, current)**: cascaded pipeline — Deepgram nova-3 STT (`language="multi"`, EN+ES) → gpt-4.1-mini LLM (`parallel_tool_calls=False`, `max_completion_tokens=500`) → ElevenLabs `eleven_flash_v2_5` TTS; Silero VAD + `MultilingualModel()` semantic turn detection; deterministic `session.say()` greeting from `src/messages/{en,es}.json`. The prompt is **single-language English** (2026-06-11 collapse); `locale` changes exactly one line — do NOT add `if locale == "es"` branches, and keep `tests/test_prompt_locale_collapse.py` green.

---

## 3. Evidence — four production calls

Tenant: "Make It AI" (test tenant, Singapore, caller +6587528516). Re-pull transcripts with:

```sql
SELECT id, created_at, duration_seconds, booking_outcome, transcript_text
FROM calls WHERE id IN (
 '31559053-3618-4cdf-80a0-272afe795229',  -- Call A
 '40b13227-da62-4b5d-8b06-c239c6460837',  -- Call B
 'd7a4560d-91bf-48bf-843e-323d9e150fc6',  -- Call C
 'eef9f785-f452-46b2-909d-6455c7559415'); -- Call D
-- Validation telemetry:
SELECT created_at, call_id, verdict, region_code FROM gmaps_validate_events ORDER BY created_at DESC LIMIT 15;
```

### Call A — 2026-06-11 07:43, 224s, `not_attempted`, caller hung up (newest deployed code: early validate_address + caller-region fallback both live)

1. **Agent defended Google's inferred postal code against the caller.** Caller gave "Eastern Sapphire, forty Canberra Drive" with NO postal code. `validate_address` (telemetry: attempt 1 US→unconfirmed, attempt 2 SG→confirmed) returned a formatted address containing postal **752106 — a value the caller never said**. Caller corrected: *"Seven six eight four three three is the postal code."* Agent: *"I already have the postal code as 752106 from the address validation."* Caller: *"No. No. No. No. No. I'm telling you it's seven six eight four three three."* — Direct violation of the CORRECTIONS rule, plus an on-air internals leak ("from the address validation").
2. **Time mis-hearings handled with open-ended re-asks ×3.** STT produced "About OrPN" / "Orpien" for "about four PM"; the agent asked "could you repeat / clarify the time" three times instead of offering a best phonetic guess ("Did you say four PM?").
3. **Too-soon dead end → hang-up.** 4 PM was <1h away; `check_slot` returned `STATE:too_soon` with **no alternative**. Agent: "Would you prefer a later time today or perhaps another day?" → caller asked closing time → agent recited hours and asked *again* → "What later time on Thursday, June 11th would you like for the appointment?" → **caller hung up**. The agent knew the schedule; the caller was made to guess blind.
4. **Intake question already answered, asked anyway.** Caller had said "it's not leaking anymore"; agent still asked "Is the water still running or have you been able to shut it off?"

### Call B — 2026-06-10 11:56, 207s, `booked`

1. **No early validation; manual confirmation spiral.** No `validate_address` at address time (telemetry shows only booking-time attempts). The agent ran THREE consecutive address confirmations, twice enumerating fields on-air ("If there's any apartment, unit, or postal code details, please let me know") — explicitly forbidden by the SERVICE ADDRESS rule ("Never run a mechanical walkthrough… Do not enumerate field names on-air").
2. **Address spoken ~5 times total**: piecewise confirm ×2, full pre-book confirm, full booking readback, full post-booking confirmation — vs the prompt's "never more than twice per call".
3. **Double questions per turn**: "Is that all correct? And may I have your name, please?"
4. **Double-confirm before booking**: "Would you like me to book that appointment for you at [full address]?" → "Yes" → "Just to confirm: the appointment is for Aleroy at [full address]…" — two confirmation rounds where one readback should suffice.
5. Stock-phrase fatigue: nearly every turn opens "Thank you for…/Could you please…".

### Call C — 2026-06-10 06:57, 268s, `booked`

1. **Wordy, padded turns**: opener ran 3 sentences ending "That way I can assist you better."; stiff meta-transitions ("Now, let's talk about scheduling the visit."); robotic date speech ("Since it's already Wednesday, June 10, 2026, today would be that date.").
2. **Three-strike scheduling guess-loop**: 4 PM → "too soon"; 5 PM → "outside business hours"; finally "Tomorrow, nine AM" worked. Each rejection offered zero alternatives.
3. Address read aloud 4×; field enumeration again ("Is there any unit number, apartment, or additional detail…").

### Call D — 2026-06-09 16:10, 247s, `booked` — **the Utah booking**

1. **STT-garbage parroting**: caller's own confirmation was transcribed "Yeah. It's Lucky Kenberg Drive." The agent read the garbage back verbatim: "The address you gave is Lucky Kenberg Drive. Is that right?" → "forty forty Canberra Drive" → parroted again → caller: "Hello? It it's just forty Canberra Drive." **Five readback rounds** for a 4-word address.
2. **Filler with no tool call**: "I'll take a moment to review the situation and then we can discuss scheduling." (nothing invoked) → caller: *"Let me just schedule it. Let's just skip the whatever."* — explicit caller frustration with the interview pace.
3. **Cross-country address corruption**: no postal code captured; booking-time validation ran with `region_code=US` (tenant.country='US' — see §5-F), Google returned `confirmed_with_changes` and the agent announced: *"Your appointment is scheduled… at 40 East Canberra Drive, **Lindon, Utah, 84042, USA**."* The Singapore caller said "Yeah" (clearly not parsing it) and a Utah address is now stored on the appointment. A country-flipping "correction" was read out as a settled fact.

---

## 4. What the perfect call looks like (design target)

> **AI**: greeting (deterministic, unchanged)
> **Caller**: "Do you do toilet repairs? Mine's leaking from the base when I flush."
> **AI**: "We do — that's a common one, and we can get someone out to you. What's the address?"
> **Caller**: "40 Canberra Drive, unit 07-04."
> **AI**: "Let me just check that address real quick. … Got it — 40 Canberra Drive, unit 07-04. Is the postal code seven six eight, four three three?" *(Google-suggested postal offered as a QUESTION, never asserted)*
> **Caller**: "Yes."
> **AI**: "And your name?" → "Leroy."
> **AI**: "When would suit you?" → "Today?"
> **AI**: "Let me look at today. … Today the earliest I could do is four-thirty, or tomorrow morning's wide open — nine or ten?" *(times all tool-returned)*
> **Caller**: "Tomorrow at nine."
> **AI**: "So that's Leroy, tomorrow at nine AM — shall I lock that in?" *(ONE confirmation; address NOT re-read — already settled)*
> **Caller**: "Yes." → **AI**: "Booking that now. … You're all set for nine tomorrow morning. Quick thing for the technician — is the water shut off, or still leaking?" *(intake AFTER the booking is secured)*
> **Caller**: answers → **AI**: "Perfect, anything else? … Thanks for calling — bye." *(pause, then end_call)*

~14 turns, address spoken twice, zero rejections without an offered alternative, zero stock phrases, all data still captured.

---

## 5. Root causes

- **A. The slot guessing game is structural.** `check_day` returns yes/no and its directive says "do not mention times" (`check_day.py:117`); `next_available_days` returns yes/no ("never specific times or dates"); `check_slot`'s `too_soon` branch (`check_slot.py:137-145`) returns *before* `fetch_scheduling_data` is even called, so it cannot offer the earliest valid time; `day_empty` offers nothing. The prompt hard-forbids speaking any slot list (`_build_booking_section`: "Never read out or list available slot times to the caller — even if they ask"). This was a Gemini-era anti-fabrication guard; with slot_tokens + gpt-4.1-mini the safe version is "speak only tool-returned times" — the data is already computed and discarded.
- **B. Address validation outranks the caller.** The prompt gives the validated form "final address" status; nothing says what wins when the caller disagrees with a *validated component* — so the model defended Google (Call A). Google verdicts (`map_verdict` in `google_maps.py` reads only `verdict.possibleNextAction`) don't distinguish components the **caller said** from components **Google inferred** (the API's `hasInferredComponents`/per-component `confirmationLevel` are ignored, but a simpler input-vs-output comparison suffices — see P2). No guard exists against a validated address landing in a different **country** than the tenant (Call D); `address_components.country_code` is already in the result and unused for this.
- **C. Address repetition arithmetic is self-contradictory.** ADDRESS VALIDATION says "never more than twice per call" and "booking does NOT re-read a validated address", but AFTER BOOKING says "Confirm the full appointment details (day, time, **address**)", and the `book_appointment` fallback (non-cached) BOOKED directives re-include the address. Minimum spoken count on the mandated path is already 3; observed 4–5.
- **D. Intake questions run as a blocking pre-booking interview.** `_build_intake_questions_section` says "After understanding the main issue, work these in naturally (skip any already answered)" — the model interprets this as "complete the checklist before scheduling" and asks them verbatim, even when already answered (Call A). Tenant data: every active service carries the same two questions ("Is the water still running…", "How long has this been going on?"), deduped to 2 per call in `agent.py:392-397`.
- **E. No register/style contract.** The prompt says "speak naturally and conversationally" but gives no banned-phrase list, no contraction requirement, and only one weak/strong example — gpt-4.1-mini defaults to call-center formalese ("Thank you for that information", "Could you please", "How may I assist you"). One-question-per-turn and the filler-requires-tool contract are stated but violated (Calls B, D) — they're mid-prompt and under-reinforced.
- **F. Tenant data bug**: `tenants.country = 'US'` for this Singapore tenant (timezone Asia/Singapore) — the direct enabler of the Utah booking. The 2026-06-11 caller-region fallback now rescues validation (Call A telemetry: US→unconfirmed, SG→confirmed) but the tenant-level fix and a code guard are both still needed.
- **G. STT noise handled naively.** The agent parrots garbled transcriptions back verbatim and retries with open-ended "could you repeat" loops instead of best-guess yes/no confirms.

---

## 6. Proposed changes

> Recommendation style note: each proposal below is the committed recommendation, not an options menu. P1 and P2's country guard reverse two documented design decisions — flagged inline.

### P1 — Kill the guessing game: guided-choice availability ⭐ highest impact

**Reverses** the skill §12 design decision "Caller-led booking — AI never offers times first." Keep the *spirit* (ask the caller's preference first; never push), drop the letter (never speak times). Anti-hallucination is preserved because **every speakable time must come from a tool return** — that invariant does not change.

**Code changes** (`livekit-agent/src/tools/`):

1. **`check_day.py`** — it already computes `all_slots`; stop discarding them. Return up to 3 representative windows spread across the day (e.g., first morning slot, first afternoon slot, last slot), each registered via `register_slot_token` (import from `_availability_lib`; same plumbing `check_slot`'s alternatives branch uses at `check_slot.py:220-224`):
   `STATE:day_has_slots date_label=… count=N | OPTIONS: 1.<speech> token=…; 2.…; 3.… | DIRECTIVE:offer two or three of these naturally; the caller may also name their own time — verify a caller-named time with check_slot. A time the caller picks from these options can be booked directly with its token.`
2. **`check_slot.py` `too_soon` branch (L137-145)** — currently returns before any schedule fetch. Move it after `fetch_scheduling_data`/`calc_slots_for_dates`, filter slots to `start >= now+1h`, and return the earliest as an alternative with a token: `STATE:too_soon requested=… earliest_today=<speech> token=… | DIRECTIVE:say that time is too soon; offer the earliest-today option or another day.` If nothing remains today, fall through to a `day_empty`-style return that names tomorrow's first window (one extra `calc_slots_for_dates` over tomorrow).
3. **`check_slot.py` `day_empty` branch (L199-213)** — same enrichment: look ahead to the next 1–2 days with availability and include the first window with a token, so "nothing that day" always arrives with "but Friday morning is open".
4. **`next_available_days.py`** — it computes 3 days of slots and returns yes/no. Return the actual day labels with availability (e.g., `STATE:has_near_availability days=Thursday June 11 (am+pm); Friday June 12 (pm) | DIRECTIVE:offer these days; once the caller picks one, offer that day's windows via check_day.`). No tokens needed here — day granularity only.
5. **`book_appointment.py` is unchanged** — tokens from `check_day`/`too_soon` alternatives resolve through the same `deps["_slot_tokens"]` registry.

**Prompt changes** (`prompt.py`, `_build_booking_section` AVAILABILITY RULES):

- Replace "Never read out or list available slot times to the caller — even if they ask 'what's available?'…" with: "You may offer specific times ONLY from a tool return in this turn, and at most two or three at once — pick a natural spread, never recite a full list. Ask the caller's preference first; offer options when they're vague, when they ask what's available, or whenever a time they wanted isn't possible. **Every rejection must come paired with the nearest workable alternative from the tool return in the same breath** — never send the caller back to guessing."
- NO DOUBLE-BOOKING block: change "only the exact slot_token string previously returned by check_slot is valid" → "…returned by an availability tool (check_slot or check_day) in this call…".
- Add: "If the caller picks one of the times you just offered, book it with that option's token directly — no second check needed." (The atomic-booking RPC still protects against races; the `slot_taken` path already recovers.)

**Why this is safe**: the Phase 60-era ban existed because Gemini fabricated times. The replacement rule still forbids fabrication — it only licenses *relaying tool output*, which `check_slot`'s alternatives branch (`ALTS:`) already does today without incident.

### P2 — Address flow: the caller is the authority; Google is a hint ⭐ highest impact

**Prompt** (`_build_address_validation_section`, preserving: the 6 prohibited phrases, untranslated verdict tokens, **no silence license anywhere** per the Phase 61.1 deadlock lesson, section position before tool_narration):

1. Add a **CALLER AUTHORITY** rule: "The validated form NEVER outranks the caller. If the caller corrects any part of a validated address — even one the validation service returned — their correction is correct (see HANDLING CORRECTIONS): accept it immediately, never defend the old value, never mention where the old value came from, and call validate_address once more with the corrected pieces. If validation still disagrees, keep the caller's version silently and treat the address as noted, not validated."
2. Add an **inferred-component rule**: "When the validated address contains a component the caller never spoke (most often the postal code), do not assert it — offer it as a question: 'Is the postal code seven five two, one zero six?' If they say no, take theirs."
3. Never speak the words "address validation"/"the validation" on-air (Call A leak) — extend the prohibited-phrase list with "the address validation" / "from the validation".

**Tool** (`validate_address.py`):

4. **Inferred-postal detection needs no Google API change**: in the tool, if the caller-supplied `postal_code` arg was empty but `result["address_components"]["postal_code"]` is present, return a new branch: `STATE:address_ok_confirm_postal speech={formatted} postal={postal} | DIRECTIVE:confirm the address in one short sentence and ask whether the postal code {postal} is right — as a question, not a statement. If the caller gives a different one, call validate_address again with it.` Same treatment when the caller's postal **differs** from the returned one (`address_corrected` already covers spoken differences, but make the directive explicitly name the changed piece instead of re-reading the whole address: "read only the changed part back").
5. **Country guard** (also in `book_appointment.py`/`capture_lead.py` where the verdict gates the `service_address` overwrite, `book_appointment.py:327-332`): if `result["address_components"]["country_code"]` is present and ≠ the region the validation *should* trust (tenant country, or caller region when the fallback won), **downgrade the verdict to the `address_noted`/unvalidated path** — never adopt the formatted address, never speak it. This makes a Call-D Utah booking impossible regardless of tenant misconfig. Implement as a small helper in `google_maps.py` or at the three call sites; keep telemetry recording the raw verdict plus a `country_mismatch=true` marker if convenient.
6. **Repetition arithmetic fix**: change AFTER BOOKING (`_build_booking_section`) from "Confirm the full appointment details (day, time, address)" to "Confirm the day and time. Do not re-read the address — it is already settled." Also adjust the two **fallback** (non-cached) `BOOKED [verdict=validated*]` directives in `book_appointment.py` (L650-672) and the `LEAD CAPTURED` equivalents in `capture_lead.py`: include the address only if it was *never read back at any point*; otherwise day+time only. (Keep the `verdict=` tokens byte-identical — tests and the prompt rule key on them.)
7. **Single confirmation moment**: in `_build_booking_section` BEFORE BOOKING — READBACK, add: "This readback IS the booking confirmation. Fold the offer into it — 'So that's {name}, {day} at {time} — shall I lock that in?' Do not ask a separate 'would you like me to book it?' question before the readback, and do not re-confirm after the caller says yes." (Kills Call B's double-confirm.)

### P3 — Intake questions: never block the booking

Rewrite `_build_intake_questions_section` preamble (current: "After understanding the main issue, work these in naturally (skip any already answered)."):

> "These are nice-to-have preparation questions for the technician — they are NOT booking requirements and must never delay scheduling. Ask at most ONE of them before the appointment is locked in, and only if it fits naturally. Ask the rest AFTER the booking is confirmed, framed briefly ('Couple quick things for the technician — …'), before the goodbye. Skip any question the caller has already answered in substance — e.g., if the caller said the leak has stopped, 'Is the water still running?' is answered; do not re-ask it. If the caller sounds rushed or asks to just book, skip them entirely. Rephrase the questions in your own conversational words; never read them like a form."

Data preservation: answers still land in the transcript (their only current destination — there is no structured intake-answer storage), just later in the call. Trade-off accepted: a caller who declines booking and bails early may yield fewer intake answers, but the evidence shows the current ordering *costs bookings* (Call A hang-up, Call D frustration), which is strictly worse.

### P4 — Conversational register contract

Extend `_build_voice_behavior_section` (and keep `_build_identity_section` as-is):

1. **Banned stock phrases** (all observed verbatim in the four calls): "Thank you for that information", "Thanks for letting me know", "Thank you for confirming", "I appreciate you letting me know", "To assist you better", "That way I can assist you better", "How may I assist you", "…that would be helpful", "Now, let's talk about scheduling". Rule: acknowledge in ≤3 casual words ("Okay." / "Got it." / "Perfect.") or skip the acknowledgment entirely; never thank the caller for information mid-call.
2. **Contractions required**: "you're / I'll / that's / we've — a receptionist who says 'I will now check the schedule' sounds like a machine."
3. **Number/date speech rules** (these directly control ElevenLabs TTS rendering since the LLM's text is spoken verbatim): postal codes digit-by-digit in groups ("seven six eight, four three three" — never "768433" in your speech text); phone numbers digit-by-digit; times as people say them ("four thirty", "nine AM"); dates without the year ("Thursday the eleventh" / "tomorrow"); never announce today's full date (Call C's "Since it's already Wednesday, June 10, 2026…").
4. **One question per turn, hard**: add the Call-B counter-example ("Is that all correct? And may I have your name?" = WRONG — two questions). Reinforce in FINAL — NON-NEGOTIABLES item 4 (append "and never two questions in one turn").
5. Greeting follow-up wording: in `_build_greeting_section`, replace the suggested "What brings you in?" (walk-in clinic phrasing) with "What can I do for you?".

### P5 — STT-noise resilience (prompt-only)

Add a short block to `_build_corrections_section` or `_build_info_gathering_section`:

> "You are hearing the caller through a phone transcription that sometimes garbles words. If an apparent correction sounds phonetically close to something the caller already confirmed ('Lucky Kenberg Drive' after 'forty Canberra Drive'), treat it as the same thing misheard — do not adopt or read back the garbled version; re-confirm the version you already had. Never read back a string that doesn't sound like a plausible name, street, or time — ask the caller to say it once more instead. When a detail comes through unclear twice, switch from 'could you repeat that?' to your best guess as a yes/no question ('Was that four PM?'); for names, ask them to spell it. Never ask the caller to repeat the same detail more than twice."

(The "max twice then best-guess" pattern would have cut Call A's three time re-asks and Call D's five address rounds.)

Also reinforce the filler-tool contract with Call D's violation as the inline WRONG example in `_build_tool_narration_section` rule 5: "'I'll take a moment to review the situation' with no tool call = lying to the caller."

### P6 — Tool description sync

Descriptions are prompt surface — they must match the new behavior or they'll fight P1/P2:
- `check_day.py` `_SCHEMA` description: remove "Returns yes/no only — never specific times".
- `next_available_days.py` `_SCHEMA`: remove "Returns yes/no — never specific times or dates".
- `validate_address.py` `_SCHEMA`: add "The caller's word always beats the validated form; re-call this tool with the caller's corrections."
- `book_appointment.py` `_BOOK_APPOINTMENT_SCHEMA`: change "Pass slot_token from the most recent check_slot result" → "…from the availability-tool result the caller chose".
- Keep all descriptions under the ~1024-char budget (Phase 61 Pitfall A6).

### P7 — Tenant data & config hygiene

1. **Immediate data fix**: `UPDATE tenants SET country = 'SG' WHERE business_name = 'Make It AI';` (verify the row first; this tenant has `country='US'` + `tenant_timezone='Asia/Singapore'`).
2. **Audit**: `SELECT id, business_name, country, tenant_timezone FROM tenants WHERE (tenant_timezone LIKE 'Asia%' AND country IN ('US','CA')) OR (tenant_timezone LIKE 'America%' AND country = 'SG');`
3. **Main repo follow-up** (onboarding flow, `onboarding-flow` skill): derive/validate `country` from the provisioned phone number's country instead of trusting a default. Not part of the agent-repo work; file separately.

### P8 — Secondary observations (UAT experiments, not blocking)

1. **Response latency**: Call B's caller said "Yes." twice waiting for the agent, and the agent was cut off mid-question ("Could you—") when the caller answered late. Experiment: `AgentSession(preemptive_generation=True)` (supported in livekit-agents 1.5.x) to start LLM+TTS on interim transcripts; keep Silero defaults and `MultilingualModel` as-is.
2. **Deepgram keyterm boosting for addresses/names**: nova-3 supports `keyterm` prompting. Feeding per-tenant terms (business name, active `services.name` list, and — if available later — common street/area names for the tenant's zones) would directly cut the "Canberra → Kenberg" class of error. One-line change at `agent.py:531` (`deepgram.STT(model="nova-3", language="multi", keyterms=[…])`) plus a small tenant-data plumb; verify the exact plugin kwarg name against `livekit-plugins-deepgram==1.5.7` before implementing.
3. **Greeting** stays deterministic/unchanged (it works well).

---

## 7. Known prompt-internal conflicts this work must resolve

1. AFTER BOOKING ("confirm day, time, address") vs ADDRESS VALIDATION ("never read the address more than twice"; "booking does NOT re-read") → resolved by P2.6.
2. NO DOUBLE-BOOKING ("only tokens from check_slot are valid") vs P1's check_day tokens → resolved by P1 prompt edit.
3. "Never list slot times" vs HANDLING THE RESULT's "offer the 2-3 nearest alternatives" (the model is simultaneously forbidden and required to speak alternative times) → resolved by P1.
4. INFO GATHERING "Never re-ask something they already told you" vs intake checklist behavior → resolved by P3's explicit "answered in substance" example.

## 8. Test impact (livekit-agent repo — run full `pytest` after each wave)

| Proposal | Tests to update / add |
|---|---|
| P1 | `test_slot_token_handoff.py`, `test_slot_cache.py` (audit), `test_prompt_booking.py` (pins "Never read out or list…" — flip the assertion), new tests for `check_day` OPTIONS shape + `too_soon` alternative |
| P2 | `test_validate_address_tool.py` (new `address_ok_confirm_postal` branch + country guard), `test_google_maps.py` (if helper added), `test_book_appointment_validation.py` + `test_capture_lead_validation.py` (directive wording — keep `verdict=` tokens byte-identical), `test_prompt_address_validation_rule.py` (new caller-authority substrings; 6→8 prohibited phrases) |
| P3 | `test_prompt.py` / `test_prompt_info_gathering.py` (intake preamble pins) |
| P4/P5 | `test_prompt_voice_behavior.py`, `test_prompt_corrections.py`, `test_prompt_final_nonnegotiables.py`, `test_prompt_tool_narration.py` |
| P6 | `test_tool_descriptions_validation_precondition.py` |
| All | `test_prompt_locale_collapse.py` must stay green (en/es prompts differ in exactly one line — no new locale branches) |

Baseline: suite was 421 passed / 1 pre-existing VIP failure (`test_incoming_call_vip_lead`) as of 2026-06-11.

## 9. Implementation order

- **Wave 1 — prompt-only (lowest risk, ship first)**: P3, P4, P5, P2 prompt parts (caller-authority, inferred-component-as-question, repetition fix, single-confirmation), P6 validate_address description. Pure `prompt.py` + test updates; fully revertable.
- **Wave 2 — tool returns + dependent prompt edits**: P1 (check_day windows, too_soon/day_empty alternatives, next_available_days day labels, AVAILABILITY RULES rewrite, token wording), P2 code parts (confirm-postal state, country guard), remaining P6.
- **Wave 3 — data/config + experiments**: P7 SQL fix + audit, P8 latency/keyterm experiments.
- **UAT script**: replay the four evidence scenarios — (1) give an address without postal and then *correct* the postal Google suggests; (2) ask "any time today?" 20 minutes before a possible slot; (3) answer an intake question pre-emptively and check it isn't re-asked; (4) mumble a street name once and confirm the agent doesn't parrot garbage. Plus one Spanish-language call (Spanish paths share the single English prompt).

## 10. Post-implementation obligations

- Update `voice-call-architecture` SKILL.md: §5 tool return shapes (check_day/next_available_days/check_slot), §12 design decision "Caller-led booking — AI never offers times first" (now "caller-preference-first; agent offers only tool-returned times"), §4 prompt section descriptions, and the Phase 61 address-validation section (caller-authority + country guard).
- Commit convention: the agent repo is the sibling `C:/Users/leheh/.Projects/livekit-agent/` (GitHub `lerboi/livekit_agent`, auto-deploys to Railway from `main`). Note there is **uncommitted work** in that repo (single-prompt collapse + caller-region fallback) — commit or confirm its state before starting.
- `tenants.country` fix (P7.1) is safe to apply immediately and independently.
