# Phase 47: Landing — Objection-Busting, Repositioning, and Landing Polish — Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds objection-busting sections, complement-not-replacement repositioning, and mobile/animation polish to the existing public landing page. The page currently has: Hero (with voice demo), HowItWorks, FeaturesCarousel, SocialProof, FinalCTA — all preserved. Phase 47 inserts new sections between these (never inside ScrollLinePath wrapper) and updates copy on Hero + FinalCTA.

**In scope:** 14 requirements — OBJ-01 through OBJ-06, OBJ-08, OBJ-09, REPOS-01 through REPOS-04, POLISH-11, POLISH-12.

**Out of scope for this phase:** OBJ-07 (revenue calculator) — already implemented on `/pricing` page (`src/app/(public)/pricing/ROICalculator.jsx`); duplicating on landing would be redundant. Requirement moved to "addressed elsewhere" in REQUIREMENTS.md.

</domain>

<decisions>
## Implementation Decisions

### Section Architecture

- **D-01:** Split emotional vs practical objections into two surfaces. OBJ-06 (identity/change-aversion) gets its own dedicated emotional section. OBJ-02, OBJ-03, OBJ-04, OBJ-05, OBJ-08, OBJ-09 consolidate into one "practical objections" grid section with multiple counter cards inside.
- **D-02:** Insertion point for all new sections is **after `</ScrollLinePath>` closing tag** (between ScrollLinePath and FinalCTASection) to preserve the copper SVG sine wave geometry. Never insert new children inside ScrollLinePath.
- **D-03:** FAQ section (OBJ-01) sits **just above FinalCTASection** as the final doubt-catcher before the CTA.
- **D-04:** REPOS-04 (owner-control pull-quote) is a **standalone section between SocialProof and FAQ** — breathing-room placement creates a pause-moment before the final commitment ask.
- **D-05:** REPOS-03 pivots from "workflow chain strip" to a **"what happens after the call" extension strip** — because HowItWorks already shows the call flow up to booking. The new strip shows what Voco keeps doing post-booking: CRM updates, notifications, follow-ups, recurring appointments, analytics. This reinforces full-stack positioning without duplicating HowItWorks content. Placement: after FeaturesCarousel (zoom-out bookend).

### FAQ (OBJ-01)

- **D-06:** FAQ includes 7 curated questions (locked set):
  1. "Does Voco sound robotic?"
  2. "What happens if Voco gets a job detail wrong?"
  3. "How much does Voco cost?"
  4. "Does Voco actually understand [my trade]?" — dynamic trade phrasing or generic, planner's discretion
  5. "How long does setup really take?"
  6. "What happens if Voco doesn't know an answer?"
  7. "Can I listen to what Voco says on my calls?"
- **D-07:** FAQ tone: **confident + specific, never defensive.** State what Voco does directly. Use specific numbers and features (85% blind-test stat, escalation chain, 4-minute setup). Avoid openers like "We understand your concern…" that signal defensiveness.
- **D-08:** Answer length: **2-3 sentences each.** Links/CTAs inside answers are allowed (e.g., "Hear it yourself →" scrolling to hero demo).
- **D-09:** Uses the existing Radix Accordion from shadcn/ui — already installed, no new deps.

### Integrated AI Chat Widget (new, extends OBJ-01)

- **D-10:** FAQ section includes a **right-side AI chat panel** beside the accordion (stacks below on mobile). Copy: "Still wondering? Ask Voco directly." Input field, send button, message thread.
- **D-11:** Chat widget reuses the existing `/api/chat` route and knowledge base (originally built for the dashboard ChatbotSheet in Phase 37). No new backend. Public landing route needs to be configured to allow anonymous access (tenant not required, or a public-visitor pseudo-tenant handled in the API).
- **D-12:** Chat widget should feel integrated with the FAQ, not a floating/popup chatbot — it's *the next step* when the accordion didn't answer their question.

### Practical Objections Grid

- **D-13:** OBJ-02, OBJ-03, OBJ-04, OBJ-05, OBJ-08, OBJ-09 rendered as a consolidated "practical objections" grid section with counter cards.
- **D-14:** Card visual treatment: **illustrations per card** (decision: illustration production pipeline deferred to planner — see Blockers). Illustration fallback per planner's judgment can be decorated Lucide icons if illustration production is not feasible in Phase 47.
- **D-15:** OBJ-09 (trade specificity) uses a **trade icon grid + brief capability list** (plumbing/HVAC/electrical/handyman/roofing, icons + one-liner per trade). No real call transcript — defers transcript/audio proof to a future phase if needed.
- **D-16:** OBJ-02 (does Voco sound robotic) card includes an **inline mini-audio player** with a pre-recorded short sample. Card also has a CTA linking back to the hero voice demo for the interactive proof.
- **D-17:** OBJ-04 (5-minute setup strip) is a **static 3-step visual** (forward number → set hours → live) — 3 numbered cards with icons + short copy. AnimatedSection fade-up on scroll is the only motion.
- **D-18:** OBJ-03 (cost of inaction) renders as a stat block with the $260,400/year figure contextualized against Voco's starting price. No calculator on landing — calculator lives on pricing page (OBJ-07 moved out of scope).

### Repositioning Copy

- **D-19:** REPOS-01 (hero H1 + subtitle): reframe to complement-not-replacement language. Specific copy drafting deferred to planner; tone guardrail: "answers when you can't", "you stay in charge". RotatingText element in hero stays.
- **D-20:** REPOS-02 (FinalCTA subtitle): reinforce owner-control framing. Tone guardrail: "your rules, your schedule". Structure unchanged; copy-only update.
- **D-21:** REPOS-04 pull-quote text: planner drafts 2-3 candidates for final selection during execution. Direction: short emotional pull-quote about owner retaining control (e.g., "You set the rules. Voco follows them.").

### Animation + Responsive Polish (POLISH-11, POLISH-12)

- **D-22:** Every new section wraps in the existing `AnimatedSection` component at `src/app/components/landing/AnimatedSection.jsx` — fade-up on scroll with `useReducedMotion` compliance already built in. No new animation library.
- **D-23:** Every new section matches the established warm-neutral background rhythm (`bg-white` / `bg-[#FAFAF9]` / `bg-[#F5F5F4]` / `bg-[#1C1412]`) — alternates to avoid back-to-back same-color blocks.
- **D-24:** Every new section stacks to single column at 375px, with md+ breakpoint introducing grid/multi-column layout. No horizontal scroll at any breakpoint.

### Claude's Discretion

- Exact copy for OBJ cards (headline + counter + stat chip) — planner drafts, based on PROBLEMS.md counter text
- Exact FAQ answer copy for all 7 questions — planner drafts under D-07 + D-08 tone guardrails
- "What happens after the call" strip content — planner chooses 4-5 items from: CRM lead creation, SMS/email notification, Google/Outlook sync, recurring appointment spawning, analytics dashboard
- Chat widget visual polish (input styling, message bubble design) — planner chooses consistent with existing landing aesthetic
- Pull-quote text (REPOS-04) — planner drafts 2-3 candidates

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research
- `.planning/research/SUMMARY.md` — Synthesis of v5.0 research; roadmap implications for Phase 47
- `.planning/research/FEATURES.md` — Feature landscape; specific recommendations for section order, card patterns, anti-features
- `.planning/research/ARCHITECTURE.md` — Insertion points (where in `page.js`), ScrollLinePath constraints
- `.planning/research/PITFALLS.md` — Tone pitfalls, ScrollLinePath breakage risk, AnimatedSection usage requirement

### Source Material
- `My Prompts/PROBLEMS.md` — The 5 objections + identity bonus objection; counter copy drafts. PRIMARY SOURCE for FAQ answer substance and practical-objection card copy.

### Existing Landing Page (do NOT duplicate)
- `src/app/page.js` — Landing entry; ScrollLinePath wrapper structure
- `src/app/components/landing/HeroSection.jsx` — Hero + voice demo; REPOS-01 edits this
- `src/app/components/landing/HeroDemoBlock.jsx` — Voice demo (ElevenLabs); OBJ-02 links back here
- `src/app/components/landing/HowItWorksSection.jsx` + `HowItWorksMinimal.jsx` — existing 4-step flow; REPOS-03 "after the call" strip bookends this
- `src/app/components/landing/FeaturesCarousel.jsx` — swipe carousel of 7 features
- `src/app/components/landing/SocialProofSection.jsx` — 3 testimonial cards
- `src/app/components/landing/FinalCTASection.jsx` — REPOS-02 edits this
- `src/app/components/landing/AnimatedSection.jsx` — fade-up wrapper; MANDATORY for all new sections (D-22)
- `src/app/components/landing/ScrollLinePath.jsx` — do not insert new sections inside this wrapper

### Reused Backend
- `src/app/api/chat/route.js` — existing chat API from Phase 37 (dashboard ChatbotSheet); FAQ chat widget reuses this (D-11). May need a public-visitor pseudo-tenant or unauthenticated mode for landing-page use.

### Existing Pricing Calculator (reference, not duplicated)
- `src/app/(public)/pricing/ROICalculator.jsx` — full calculator on pricing page; replaces what would have been OBJ-07 on landing

### FAQ Dependencies
- shadcn Accordion — already installed via existing shadcn setup; FAQ uses this primitive

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AnimatedSection** (`src/app/components/landing/AnimatedSection.jsx`) — fade-up on scroll, useReducedMotion built-in. ALL new sections wrap in this.
- **shadcn Accordion** — already installed; FAQ primitive.
- **`/api/chat` route** — Phase 37 dashboard chatbot backend; reusable for FAQ chat widget (D-11).
- **HeroDemoBlock** — existing voice proof; OBJ-02 links back, does NOT duplicate.
- **ROICalculator** — exists on pricing page; landing links to pricing instead of duplicating.

### Established Patterns
- **Warm-neutral background rhythm**: alternates `bg-white` / `bg-[#FAFAF9]` / `bg-[#F5F5F4]` / `bg-[#1C1412]` across sections. New sections must match.
- **Landing sections use hardcoded hex colors** (intentional — immune to v5.0 dark mode which scopes to dashboard only).
- **Lucide icons** are the standard icon library on landing.
- **framer-motion** (already installed) + `useReducedMotion` is the motion toolkit. No new animation deps.

### Integration Points
- `src/app/page.js` — landing entry; new sections added here. ScrollLinePath children are FIXED (HowItWorks + FeaturesCarousel + SocialProof only) — new sections go after `</ScrollLinePath>` closing tag, before FinalCTASection.
- Route order for new sections: `Hero → [existing] → ScrollLinePath{HowItWorks → FeaturesCarousel → [after-the-call strip] → SocialProof} → [OBJ-06 identity section] → [practical objections grid] → [REPOS-04 pull-quote] → [FAQ + chat widget] → FinalCTA`.

</code_context>

<specifics>
## Specific Ideas

- **OBJ-03 anchor stat:** $260,400/year figure from PROBLEMS.md (42 calls/mo × 74% miss rate × $1,000 avg job). Contextualized against Voco's starting price (e.g., "Voco starts at $X/month. Miss one extra job and it's paid for.").
- **OBJ-02 stat:** "85% of callers can't distinguish modern AI voice from a real receptionist." Source: PROBLEMS.md research, 2025 blind-test studies.
- **OBJ-04 3-step:** (1) Forward your number → (2) Set your hours → (3) You're live. Sub-label: "Average setup: 4m 12s" or equivalent honest stat if available.
- **Chat widget copy direction:** Header "Still wondering? Ask Voco directly." Placeholder "Ask anything about Voco…" Empty state with 2-3 suggestion chips seeded from FAQ questions.
- **REPOS-04 direction:** "You set the rules. Voco follows them." or similar short owner-identity statement. Planner drafts candidates.

</specifics>

<deferred>
## Deferred Ideas

- **Revenue calculator on landing (OBJ-07)** — already exists on `/pricing`. Not rebuilt. REQUIREMENTS.md updated to move OBJ-07 to "addressed elsewhere". If A/B tests later show landing-page calculator would lift conversion, add as a future phase.
- **Illustration production pipeline** — planner decides per-plan whether to commission, AI-generate, or fall back to decorated icons for the practical-objections grid cards. Full illustration system is out of scope for Phase 47 if it would block delivery.
- **Real trade-specific call transcript/audio on OBJ-09** — deferred due to legal/privacy clearance needed. OBJ-09 ships with trade icon grid + capability list instead (D-15).
- **Mobile-specific section variant** — Phase 47 enforces responsive reflow (POLISH-12); dedicated mobile-only sections/variants are out of scope.
- **Pop-up / floating chatbot on landing** — rejected in research (mode confusion with HeroDemoBlock). Chat lives *inside* FAQ section only.

### Reviewed Todos (not folded)
None — no matching todos surfaced for Phase 47.

</deferred>

---

*Phase: 47-landing-objection-busting-repositioning-and-landing-polish*
*Context gathered: 2026-04-13*
