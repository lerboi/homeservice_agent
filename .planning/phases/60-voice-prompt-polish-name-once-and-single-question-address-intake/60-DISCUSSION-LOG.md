# Phase 60: Voice prompt polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 60-voice-prompt-polish-name-once-and-single-question-address-intake
**Areas discussed:** Name readback moment, Caller-requested name override, Single-question address opener, capture_lead tool parity, Corrections during readback, Spanish (es.json) parity, Name-extraction fallbacks, Structural pass scope

---

## Name readback moment

| Option | Description | Selected |
|--------|-------------|----------|
| Booking confirmation only | Name read once, right before book_appointment fires, together with address — the single authoritative readback | ✓ |
| Address readback + booking confirmation | Name repeated at address readback and at final confirmation — more correction chances but doubles TTS exposure | |
| Never on-air | Name captured silently; never vocalized. Loses the verification moment | |

| Option | Description | Selected |
|--------|-------------|----------|
| Required on every booking | Every booking readback includes the name | ✓ |
| Required unless caller explicitly skipped providing it | Conditional | |
| Claude's discretion | Prompt writer decides | |

**Notes:** Lands in CONTEXT.md as D-01, D-02.

---

## Caller-requested name override

| Option | Description | Selected |
|--------|-------------|----------|
| Honor the request — use vocative naturally | Explicit caller preference overrides the no-vocative rule | ✓ |
| Honor but rate-limit | At most once per 2-3 turns even when overridden | |
| Never override | Keep no-vocative rule even if caller asks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Outcome-framed | Rule: "If caller invites you to use their name, you may." Gemini interprets natural phrasings | ✓ |
| Enumerated triggers | Prompt lists specific phrases | |

**Notes:** Lands in CONTEXT.md as D-03. No enumerated trigger list; outcome-framed only.

---

## Single-question address opener

| Option | Description | Selected |
|--------|-------------|----------|
| "What's the address where you need the service?" | User's exact framing. Neutral across SG/US/CA | ✓ |
| "Can you give me the full service address?" | More formal; may feel bureaucratic | |
| Variable wording | Prompt gives rule + example; actual wording varies | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ask only for what's missing, one thing at a time | Extract volunteered info; single targeted follow-up per missing piece | ✓ |
| Summarize + ask for everything missing at once | Form-like | |
| Claude's discretion | Outcome rule only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Enough to validate | Outcome-framed; matches Phase 61's validator needs | ✓ |
| Strict three-field rule (current) | Postal + street + unit all required | |
| Only street + postal; unit explicitly optional | Enumerated but relaxed | |

**Notes:** Lands in CONTEXT.md as D-06, D-07, D-08.

---

## capture_lead tool parity

| Option | Description | Selected |
|--------|-------------|----------|
| Update description only — same intake rules | Tool signature unchanged; description reflects single-question framing | ✓ |
| Leave capture_lead as-is | Accept divergence between booking and decline flows | |
| Full parity — update signature and description | Largest change; widens phase scope | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — read name+address back once before capture | Consistent verification moment across both paths | ✓ |
| No — decline path can skip readback | Lower friction on decline | |
| Claude's discretion | Prompt writer decides | |

**Notes:** Lands in CONTEXT.md as D-11, D-12.

---

## Corrections during readback

| Option | Description | Selected |
|--------|-------------|----------|
| Implicit — rely on existing CORRECTIONS rule | Phase 30's rule covers this; add one line near readback | ✓ |
| Explicit readback protocol | Prompt spells out single-word-correction protocol | |
| No change | Existing CORRECTIONS section is sufficient as-is | |

| Option | Description | Selected |
|--------|-------------|----------|
| Just acknowledge + proceed | "Got it, 456." Then book | |
| Re-read the corrected full address | Safer; accepts more TTS exposure | ✓ |
| Claude's discretion | Prompt writer picks | |

**Notes:** Lands in CONTEXT.md as D-09, D-10. User preferred re-reading the full corrected address over the more minimal acknowledge-and-proceed option — prioritizes verification completeness over minimizing TTS exposure.

---

## Spanish (es.json) parity

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the English changes 1:1 | Same rules, localized phrasing | ✓ |
| Mirror no-vocative, keep current ES address flow | Lower risk on address side | |
| Skip Spanish in this phase — defer | Ship English-only now | |

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drafts, user reviews | User can tweak before commit | ✓ |
| User writes, Claude integrates | User provides final phrasings | |
| Machine-translate, no review | Fastest; rough phrasing | |

**Notes:** Lands in CONTEXT.md as D-13, D-14.

---

## Name-extraction fallbacks

| Option | Description | Selected |
|--------|-------------|----------|
| Proceed without name, skip name portion of readback | Don't block booking; tolerant behavior | ✓ |
| Ask once more, then proceed without | One polite retry | |
| Block booking without a name | Too aggressive | |

| Option | Description | Selected |
|--------|-------------|----------|
| Standard readback — caller will correct if wrong | CORRECTIONS rule handles mispronunciation | ✓ |
| Explicit "let me make sure I have your name right" | Extra verification when caller spelled it out | |
| Claude's discretion | Prompt writer decides | |

**Notes:** Lands in CONTEXT.md as D-04, D-05.

---

## Structural pass scope

| Option | Description | Selected |
|--------|-------------|----------|
| Light audit — verify only, change only if clearly broken | Primary scope = A+B; fix inline only if something is broken | ✓ |
| Full structural pass alongside A+B | Active rewrite of tool returns, anti-hallucination re-hoist, strip VAD-redundant lines | |
| Defer all structural work | Spin up Phase 60.1 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Only if a tool return reads as speakable English | Tighten just the at-risk ones | |
| Rewrite all tool returns to strict state+directive format | Uniform treatment across all tools | ✓ |
| Out of scope | Don't touch tool returns | |

**Notes:** Lands in CONTEXT.md as D-15, D-16. User split the structural pass: **light audit** of the prompt (D-15) + **full rewrite** of all tool return strings (D-16). Not contradictory — the prompt structure itself is mostly left alone, but every tool return gets normalized to state+directive format.

## Claude's Discretion

See CONTEXT.md `<decisions>` → `### Claude's Discretion` — six items covering exact prompt wording, Spanish phrasing review loop, "enough to validate" encoding, correction-line form, commit granularity for D-16, and readback utterance order.

## Deferred Ideas

See CONTEXT.md `<deferred>` — travel buffer, full tool-signature parity, tenant-configurable vocative, pronunciation feedback loop, dashboard surface, Retell-era prompt cleanup.
